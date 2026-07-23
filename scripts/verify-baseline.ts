import { readFileSync, existsSync } from "fs";

const p = ".env.local";
if (existsSync(p)) {
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

async function main() {
  const { getEmployees, getLeaveRequests, computeBalances } = await import(
    "../lib/data"
  );
  const targets = [
    "Richard Kuphila Mazwarira",
    "Virginia Mudede",
    "Shaun Streaton",
    "Bongwe Sibanda",
    "Busisiwe Mary Sithole",
  ];
  const excelDue: Record<string, number> = {
    "Richard Kuphila Mazwarira": 13.5,
    "Virginia Mudede": 7.25,
    "Shaun Streaton": 17.78,
    "Bongwe Sibanda": 10.5,
    "Busisiwe Mary Sithole": 7.5,
  };
  const emps = await getEmployees();
  const reqs = await getLeaveRequests();
  const bals = computeBalances(emps, reqs);
  const withOpen = emps.filter((e) => e.openingAnnualBalance != null).length;
  console.log(
    JSON.stringify({ totalEmps: emps.length, withOpenings: withOpen }, null, 2)
  );

  function norm(s: string) {
    return s
      .toLowerCase()
      .replace(/^(mrs?|ms|miss)\.?\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  for (const t of targets) {
    const e = emps.find(
      (x) => norm(x.name) === norm(t) || norm(x.name).includes(norm(t))
    );
    if (!e) {
      console.log(JSON.stringify({ target: t, found: false }));
      continue;
    }
    const annual = bals.find(
      (b) => b.employeeId === e.id && b.type === "Annual"
    );
    console.log(
      JSON.stringify(
        {
          name: e.name,
          opening: e.openingAnnualBalance,
          asOf: e.openingBalanceAsOf,
          excelDueJun30: excelDue[t],
          vacateRemaining: annual?.remaining,
          vacateTakenPostCutover: annual?.taken,
          vacateEntitled: annual?.entitled,
          deltaToExcelDue:
            annual && excelDue[t] != null
              ? Math.round((annual.remaining - excelDue[t]) * 100) / 100
              : null,
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
