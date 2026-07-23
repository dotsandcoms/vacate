import { promises as fs } from "fs";
import path from "path";
import { Employee } from "./types";

export type OpeningRecord = {
  employeeNo?: string;
  name: string;
  excelName: string;
  annual: number | null;
  sick: number | null;
  family: number | null;
  matchScore?: number;
};

export type OpeningsFile = {
  asOf: string;
  source: string;
  importedAt: string;
  openings: OpeningRecord[];
  unmatched: OpeningRecord[];
};

const OPENINGS_PATH = path.join(process.cwd(), ".vacate-data", "excel-openings.json");

/**
 * Load Excel baseline openings written by the import script (if present).
 */
export async function readOpeningsFile(): Promise<OpeningsFile | null> {
  try {
    const raw = await fs.readFile(OPENINGS_PATH, "utf8");
    const data = JSON.parse(raw) as OpeningsFile;
    if (!data?.asOf || !Array.isArray(data.openings)) return null;
    return data;
  } catch {
    return null;
  }
}

export function openingsFilePath(): string {
  return OPENINGS_PATH;
}

/**
 * Overlay file-based openings onto employees (by employeeNo, then name).
 * Supabase column values win when already set.
 */
export function mergeOpeningsOntoEmployees(
  employees: Employee[],
  file: OpeningsFile | null
): Employee[] {
  if (!file) return employees;

  const byNo = new Map(
    file.openings
      .filter((o) => o.employeeNo)
      .map((o) => [o.employeeNo!.toUpperCase(), o])
  );
  const byName = new Map(
    file.openings.map((o) => [normalizePersonName(o.name), o])
  );

  return employees.map((e) => {
    if (
      e.openingAnnualBalance != null ||
      e.openingSickBalance != null ||
      e.openingBalanceAsOf
    ) {
      return e;
    }
    const hit =
      byNo.get(e.employeeNo.toUpperCase()) ??
      byName.get(normalizePersonName(e.name));
    if (!hit) return e;
    return {
      ...e,
      openingAnnualBalance: hit.annual,
      openingSickBalance: hit.sick,
      openingFamilyBalance: hit.family,
      openingBalanceAsOf: file.asOf,
      excelName: hit.excelName,
    };
  });
}

/** Strip titles and collapse whitespace for matching. */
export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(mrs?|ms|miss)\.?\s+/i, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well two people names match (0–1).
 */
export function nameMatchScore(a: string, b: string): number {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = na.split(" ").filter((t) => t.length > 1);
  const tb = nb.split(" ").filter((t) => t.length > 1);
  if (ta.length === 0 || tb.length === 0) return 0;

  const tbSet = new Set(tb);
  let inter = 0;
  for (const t of ta) if (tbSet.has(t)) inter++;
  const union = new Set(ta.concat(tb)).size;
  const jaccard = inter / union;

  // Prefer sharing last token (surname)
  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  const lastBonus = lastA && lastA === lastB ? 0.15 : 0;

  return Math.min(1, jaccard + lastBonus);
}
