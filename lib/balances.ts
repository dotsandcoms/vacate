// Leave balance engine.
//
// Preferred path (Excel baseline):
//   remaining = opening_at_cutover
//             + accrual for full months after cutover
//             − Kissflow/Supabase leave starting after cutover
//
// Fallback (no Excel opening): original BCEA pro-rata engine.
import { Employee, LeaveRequest, LeaveBalance, LeaveType } from "./types";
import { config } from "./config";
import { todayIso } from "./holidays";

const COUNTED_STATUSES = new Set(["Approved", "Pending Sync", "Exported"]);

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function takenAfter(
  requests: LeaveRequest[],
  employeeId: string,
  type: LeaveType,
  asOfExclusiveEnd: string
): number {
  // Leave that *starts* on or before as-of is assumed already in the Excel due row.
  return requests
    .filter(
      (r) =>
        r.employeeId === employeeId &&
        r.type === type &&
        COUNTED_STATUSES.has(r.status) &&
        r.startDate > asOfExclusiveEnd
    )
    .reduce((s, r) => s + r.days, 0);
}

function takenInWindow(
  requests: LeaveRequest[],
  employeeId: string,
  type: LeaveType,
  fromIso: string,
  toIso: string
): number {
  return requests
    .filter(
      (r) =>
        r.employeeId === employeeId &&
        r.type === type &&
        COUNTED_STATUSES.has(r.status) &&
        r.startDate >= fromIso &&
        r.startDate <= toIso
    )
    .reduce((s, r) => s + r.days, 0);
}

/** Full month-ends strictly after asOf up to and including today's month. */
export function monthsAccruedAfter(asOfIso: string, todayIsoDate: string): number {
  const [ay, am] = asOfIso.split("-").map(Number);
  const [ty, tm] = todayIsoDate.split("-").map(Number);
  return Math.max(0, (ty - ay) * 12 + (tm - am));
}

function hasExcelBaseline(emp: Employee): boolean {
  return (
    emp.openingAnnualBalance != null ||
    emp.openingSickBalance != null ||
    emp.openingFamilyBalance != null
  );
}

/**
 * Compute leave balances. Uses Excel openings when present; otherwise BCEA.
 */
export function computeBalancesBcea(
  employees: Employee[],
  requests: LeaveRequest[]
): LeaveBalance[] {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const cycleStart = `${year}-${String(config.cycleStartMonth).padStart(2, "0")}-01`;
  const monthsElapsed =
    (Number(today.slice(5, 7)) - config.cycleStartMonth + 12) % 12 || 12;
  const sickFrom = `${year - 3}${today.slice(4)}`;

  const balances: LeaveBalance[] = [];

  for (const emp of employees) {
    if (hasExcelBaseline(emp)) {
      const asOf =
        emp.openingBalanceAsOf?.slice(0, 10) || config.excelBaselineAsOf;
      const accruedMonths = monthsAccruedAfter(asOf, today);
      const annualAccrual = accruedMonths * config.annualAccrualPerMonth;

      const annualOpening = emp.openingAnnualBalance ?? 0;
      const annualTaken = takenAfter(requests, emp.id, "Annual", asOf);
      const annualRemaining = roundQuarter(
        annualOpening + annualAccrual - annualTaken
      );

      const sickOpening =
        emp.openingSickBalance != null
          ? emp.openingSickBalance
          : emp.sickEntitlement;
      const sickTaken =
        emp.openingSickBalance != null
          ? takenAfter(requests, emp.id, "Sick", asOf)
          : takenInWindow(requests, emp.id, "Sick", sickFrom, today);
      const sickRemaining = roundQuarter(sickOpening - sickTaken);

      const frOpening = emp.openingFamilyBalance ?? 3;
      const frTaken =
        emp.openingFamilyBalance != null
          ? takenAfter(requests, emp.id, "Family Responsibility", asOf)
          : takenInWindow(
              requests,
              emp.id,
              "Family Responsibility",
              `${year}-01-01`,
              `${year}-12-31`
            );
      const frRemaining = roundQuarter(frOpening - frTaken);

      balances.push(
        {
          employeeId: emp.id,
          type: "Annual",
          // Entitled = baseline + post-cutover accrual (what they "own" this period)
          entitled: roundQuarter(annualOpening + annualAccrual),
          taken: annualTaken,
          remaining: annualRemaining,
        },
        {
          employeeId: emp.id,
          type: "Sick",
          entitled: roundQuarter(sickOpening),
          taken: sickTaken,
          remaining: sickRemaining,
        },
        {
          employeeId: emp.id,
          type: "Family Responsibility",
          entitled: roundQuarter(frOpening),
          taken: frTaken,
          remaining: frRemaining,
        }
      );
      continue;
    }

    // ── Fallback BCEA ────────────────────────────────────────────────────
    const annualAccrued = Math.min(
      emp.annualEntitlement,
      roundQuarter(monthsElapsed * config.annualAccrualPerMonth)
    );
    const annualTaken = takenInWindow(
      requests,
      emp.id,
      "Annual",
      cycleStart,
      `${year}-12-31`
    );
    const sickTaken = takenInWindow(
      requests,
      emp.id,
      "Sick",
      sickFrom,
      today
    );
    const frTaken = takenInWindow(
      requests,
      emp.id,
      "Family Responsibility",
      `${year}-01-01`,
      `${year}-12-31`
    );

    balances.push(
      {
        employeeId: emp.id,
        type: "Annual",
        entitled: annualAccrued,
        taken: annualTaken,
        remaining: roundQuarter(annualAccrued - annualTaken),
      },
      {
        employeeId: emp.id,
        type: "Sick",
        entitled: emp.sickEntitlement,
        taken: sickTaken,
        remaining: emp.sickEntitlement - sickTaken,
      },
      {
        employeeId: emp.id,
        type: "Family Responsibility",
        entitled: 3,
        taken: frTaken,
        remaining: 3 - frTaken,
      }
    );
  }

  return balances;
}

/** Rand value of accrued-but-untaken annual leave across the company. */
export function leaveLiabilityR(
  employees: Employee[],
  balances: LeaveBalance[]
): number {
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  return balances
    .filter((b) => b.type === "Annual" && b.remaining > 0)
    .reduce(
      (sum, b) =>
        sum +
        b.remaining *
          (byId[b.employeeId]?.dailyCostR ?? config.avgDailyCostR),
      0
    );
}

export function formatRand(v: number): string {
  return "R" + Math.round(v).toLocaleString("en-ZA").replace(/,/g, " ");
}
