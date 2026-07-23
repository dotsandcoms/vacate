// BCEA-aware leave balance engine.
//
// Basic Conditions of Employment Act rules implemented:
//  - Annual leave: accrues at 1.25 working days per month worked (15/year),
//    computed pro-rata for the current cycle.
//  - Sick leave: 30 days per 36-month cycle (for a 5-day week). Taken days
//    are counted over the trailing 36 months.
//  - Family responsibility: 3 days per 12-month cycle, non-cumulative.
//
// Known gaps until the Excel register is imported: opening balances,
// carry-over from previous cycles, and per-employee hire dates (accrual
// currently assumes employment for the whole cycle).
import { Employee, LeaveRequest, LeaveBalance, LeaveType } from "./types";
import { config } from "./config";
import { todayIso } from "./holidays";

const COUNTED_STATUSES = new Set(["Approved", "Pending Sync", "Exported"]);

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

export function computeBalancesBcea(
  employees: Employee[],
  requests: LeaveRequest[]
): LeaveBalance[] {
  const today = todayIso();
  const year = Number(today.slice(0, 4));

  // Current annual cycle
  const cycleStart = `${year}-${String(config.cycleStartMonth).padStart(2, "0")}-01`;
  const monthsElapsed =
    (Number(today.slice(5, 7)) - config.cycleStartMonth + 12) % 12 || 12;

  // Trailing 36 months for sick leave
  const sickFrom = `${year - 3}${today.slice(4)}`;

  const balances: LeaveBalance[] = [];
  for (const emp of employees) {
    // Annual: pro-rata accrual capped at full entitlement
    const annualAccrued = Math.min(
      emp.annualEntitlement,
      Math.round(monthsElapsed * config.annualAccrualPerMonth * 4) / 4
    );
    const annualTaken = takenInWindow(requests, emp.id, "Annual", cycleStart, today.slice(0, 4) + "-12-31");

    // Sick: 36-month cycle
    const sickTaken = takenInWindow(requests, emp.id, "Sick", sickFrom, today);

    // Family responsibility: current calendar year, 3 days, non-cumulative
    const frTaken = takenInWindow(requests, emp.id, "Family Responsibility", `${year}-01-01`, `${year}-12-31`);

    balances.push(
      {
        employeeId: emp.id,
        type: "Annual",
        entitled: annualAccrued,
        taken: annualTaken,
        remaining: Math.round((annualAccrued - annualTaken) * 4) / 4,
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
        sum + b.remaining * (byId[b.employeeId]?.dailyCostR ?? config.avgDailyCostR),
      0
    );
}

export function formatRand(v: number): string {
  return "R" + Math.round(v).toLocaleString("en-ZA").replace(/,/g, " ");
}
