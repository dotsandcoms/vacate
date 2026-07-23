/**
 * Match Excel baseline openings to Vacate employees and write
 * `.vacate-data/excel-openings.json`. Optionally push to Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-excel-baseline.ts
 *   npx tsx scripts/import-excel-baseline.ts --apply-supabase
 *   npx tsx scripts/import-excel-baseline.ts --as-of 2026-06-30
 */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  nameMatchScore,
  normalizePersonName,
  openingsFilePath,
  type OpeningRecord,
  type OpeningsFile,
} from "../lib/openings";

function loadEnv() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

type RawPerson = {
  excelName: string;
  name: string;
  normalized: string;
  annual: number | null;
  sick: number | null;
  family: number | null;
};

type Emp = {
  id: string;
  employee_no: string;
  name: string;
  department: string;
};

async function main() {
  loadEnv();
  const asOf = argValue("--as-of") ?? "2026-06-30";
  const xlsx =
    argValue("--xlsx") ?? "leavedata/Staff Leave 2025 - 2027.xlsx";
  const applySupabase = process.argv.includes("--apply-supabase");
  const rawPath = resolve("leavedata/baseline-raw.json");

  console.log(`Extracting Excel openings as-of ${asOf}…`);
  const py = spawnSync(
    "python3",
    [
      "scripts/extract-excel-baseline.py",
      "--xlsx",
      xlsx,
      "--as-of",
      asOf,
      "--out",
      rawPath,
    ],
    { encoding: "utf8" }
  );
  if (py.status !== 0) {
    console.error(py.stdout);
    console.error(py.stderr);
    process.exit(1);
  }
  console.log(py.stdout.trim());

  const raw = JSON.parse(readFileSync(rawPath, "utf8")) as {
    asOf: string;
    source: string;
    people: RawPerson[];
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) },
  });

  const { data: employees, error } = await sb
    .from("employees")
    .select("id, employee_no, name, department")
    .order("name");
  if (error) throw error;
  const emps = (employees ?? []) as Emp[];
  console.log(`Loaded ${emps.length} Supabase employees`);

  const used = new Set<string>();
  const openings: OpeningRecord[] = [];
  const unmatched: OpeningRecord[] = [];

  for (const person of raw.people) {
    // Skip columns with no annual or sick value at all
    if (person.annual == null && person.sick == null) {
      unmatched.push({
        name: person.name,
        excelName: person.excelName,
        annual: person.annual,
        sick: person.sick,
        family: person.family,
        matchScore: 0,
      });
      continue;
    }

    let best: { emp: Emp; score: number } | null = null;
    for (const emp of emps) {
      if (used.has(emp.id)) continue;
      const score = nameMatchScore(person.name, emp.name);
      if (!best || score > best.score) best = { emp, score };
    }

    if (!best || best.score < 0.55) {
      unmatched.push({
        name: person.name,
        excelName: person.excelName,
        annual: person.annual,
        sick: person.sick,
        family: person.family,
        matchScore: best?.score ?? 0,
      });
      continue;
    }

    used.add(best.emp.id);
    openings.push({
      employeeNo: best.emp.employee_no,
      name: best.emp.name,
      excelName: person.excelName,
      annual: person.annual,
      sick: person.sick,
      family: person.family,
      matchScore: Math.round(best.score * 100) / 100,
    });
  }

  const file: OpeningsFile = {
    asOf: raw.asOf,
    source: raw.source,
    importedAt: new Date().toISOString(),
    openings,
    unmatched,
  };

  const outPath = openingsFilePath();
  mkdirSync(resolve(".vacate-data"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2));
  console.log(
    `Wrote ${outPath}: matched=${openings.length} unmatched=${unmatched.length}`
  );

  // Show sample + weak matches
  const weak = openings.filter((o) => (o.matchScore ?? 0) < 0.75).slice(0, 10);
  if (weak.length) {
    console.log("Weak matches to review:");
    for (const w of weak) {
      console.log(
        `  ${w.excelName} → ${w.name} (${w.employeeNo}) score=${w.matchScore}`
      );
    }
  }

  if (!applySupabase) {
    console.log(
      "Dry run only (local JSON). Re-run with --apply-supabase after migration 001."
    );
    return;
  }

  console.log("Applying openings to Supabase employees…");
  let updated = 0;
  let failed = 0;
  for (const o of openings) {
    if (!o.employeeNo) continue;
    const { error: upErr } = await sb
      .from("employees")
      .update({
        opening_annual_balance: o.annual,
        opening_sick_balance: o.sick,
        opening_family_balance: o.family,
        opening_balance_as_of: raw.asOf,
        excel_name: o.excelName,
      })
      .eq("employee_no", o.employeeNo);
    if (upErr) {
      failed++;
      if (failed <= 5) console.error(o.employeeNo, upErr.message);
    } else {
      updated++;
    }
  }
  console.log(`Supabase update done: ok=${updated} failed=${failed}`);
  if (failed) {
    console.log(
      "If columns are missing, run supabase/migrations/001_opening_balances.sql first."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
