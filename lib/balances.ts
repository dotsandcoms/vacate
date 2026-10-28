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
import { addDaysIso, todayIso, workingDays } from "./holidays";

const COUNTED_STATUSES = new Set(["Approved", "Pending Sync", "Exported"]);

function roundDays(n: number): number {
  return Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
}

function takenAfter(
  requests: LeaveRequest[],
  employeeId: string,
  type: LeaveType,
  fromIso: string,
  toIso?: string
): { days: number; requiresReview: boolean } {
  let days = 0;
  let requiresReview = false;
  for (const r of requests) {
    if (r.employeeId !== employeeId || r.type !== type ||
        !COUNTED_STATUSES.has(r.status) || r.endDate < fromIso ||
        (toIso && r.startDate > toIso)) continue;
    const start = r.startDate < fromIso ? fromIso : r.startDate;
    const end = toIso && r.endDate > toIso ? toIso : r.endDate;
    if (start === r.startDate && end === r.endDate) {
      days += Number(r.days);
    } else if (workingDays(r.startDate, r.endDate) === Number(r.days)) {
      days += workingDays(start, end);
    } else {
      requiresReview = true;
    }
  }
  return { days: roundDays(days), requiresReview };
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

/** Correct leave already included in an imported opening, once per request. */
function openingCorrection(
  requests: LeaveRequest[], employeeId: string, type: LeaveType, openingDate: string
): { days: number; requiresReview: boolean } {
  let days = 0;
  let requiresReview = false;
  const end = addDaysIso(openingDate, -1);
  const from = type === "Family Responsibility" ? `${openingDate.slice(0, 4)}-01-01` : "0001-01-01";
  for (const request of requests) {
    if (request.employeeId !== employeeId || !request.adjustment) continue;
    const original = { ...request, ...request.adjustment.original };
    const before = takenAfter([original], employeeId, type, from, end);
    const after = takenAfter([request], employeeId, type, from, end);
    if (before.requiresReview || after.requiresReview) {
      requiresReview = true;
      continue;
    }
    days += before.days - after.days;
  }
  return { days: roundDays(days), requiresReview };
}

/** Month-ends on or after the opening date, through the current date. */
export function monthsAccruedAfter(asOfIso: string, todayIsoDate: string): number {
  if (todayIsoDate < asOfIso) return 0;
  const [ay, am] = asOfIso.split("-").map(Number);
  const [ty, tm, td] = todayIsoDate.split("-").map(Number);
  const currentMonthEnd = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return Math.max(0, (ty - ay) * 12 + (tm - am) + (td === currentMonthEnd ? 1 : 0));
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
  requests: LeaveRequest[],
  asOfDate = todayIso()
): LeaveBalance[] {
  const today = asOfDate;
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
      // Earlier imports use the final included day; the November import uses
      // the first day of the opening period.
      const openingDate = asOf >= "2026-11-01" ? asOf : addDaysIso(asOf, 1);
      const accruedMonths = monthsAccruedAfter(openingDate, today);
      const annualAccrual = accruedMonths * (emp.monthlyAccrual ?? config.annualAccrualPerMonth);

      const annualTaken = takenAfter(requests, emp.id, "Annual", openingDate);
      const annualCorrection = openingCorrection(requests, emp.id, "Annual", openingDate);
      const annualOpening = emp.openingAnnualBalance == null ? null : emp.openingAnnualBalance + annualCorrection.days;

      const sickCorrection = openingCorrection(requests, emp.id, "Sick", openingDate);

      const sickOpening =
        emp.openingSickBalance != null
          ? emp.openingSickBalance + sickCorrection.days
          : emp.sickEntitlement;
      const sickTaken =
        emp.openingSickBalance != null
          ? takenAfter(requests, emp.id, "Sick", openingDate)
          : { days: takenInWindow(requests, emp.id, "Sick", sickFrom, today), requiresReview: false };
      const sickRemaining = roundDays(sickOpening - sickTaken.days);

      const openingYear = Number(openingDate.slice(0, 4));
      const frCorrection = openingCorrection(requests, emp.id, "Family Responsibility", openingDate);
      const frOpening = year > openingYear ? 3 : (emp.openingFamilyBalance ?? 3) + (emp.openingFamilyBalance != null ? frCorrection.days : 0);
      const frFrom = year > openingYear ? `${year}-01-01` : openingDate;
      const frTaken =
        emp.openingFamilyBalance != null
          ? takenAfter(requests, emp.id, "Family Responsibility", frFrom, `${Math.max(year, openingYear)}-12-31`)
          : { days: takenInWindow(
              requests,
              emp.id,
              "Family Responsibility",
              `${year}-01-01`,
              `${year}-12-31`
            ), requiresReview: false };
      const frRemaining = roundDays(frOpening - frTaken.days);

      if (annualOpening != null) {
        balances.push({
          employeeId: emp.id,
          type: "Annual",
          // Entitled = baseline + post-cutover accrual (what they "own" this period)
          entitled: roundDays(annualOpening + annualAccrual),
          taken: annualTaken.days,
          remaining: roundDays(annualOpening + annualAccrual - annualTaken.days),
          requiresReview: annualTaken.requiresReview || annualCorrection.requiresReview,
        });
      }
      balances.push(
        {
          employeeId: emp.id,
          type: "Sick",
          entitled: roundDays(emp.sickEntitlement),
          taken: roundDays(emp.sickEntitlement - sickOpening + sickTaken.days),
          remaining: sickRemaining,
          requiresReview: sickTaken.requiresReview || (emp.openingSickBalance != null && sickCorrection.requiresReview),
        },
        {
          employeeId: emp.id,
          type: "Family Responsibility",
          entitled: 3,
          taken: roundDays(3 - frOpening + frTaken.days),
          remaining: frRemaining,
          requiresReview: frTaken.requiresReview || (year <= openingYear && emp.openingFamilyBalance != null && frCorrection.requiresReview),
        }
      );
      continue;
    }

    // ── Fallback BCEA ────────────────────────────────────────────────────
    const annualAccrued = Math.min(
      emp.annualEntitlement,
      roundDays(monthsElapsed * (emp.monthlyAccrual ?? config.annualAccrualPerMonth))
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
        remaining: roundDays(annualAccrued - annualTaken),
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

/** Estimated cost of one working day for an employee (placeholder until payroll). */
export function employeeDailyCost(emp: Employee | undefined): number | null {
  return emp?.dailyCostR === null ? null : emp?.dailyCostR ?? config.avgDailyCostR;
}

/** Rand value of one employee's accrued-but-untaken annual leave. */
export function employeeAnnualLiabilityR(
  emp: Employee,
  balances: LeaveBalance[]
): number | null {
  const annual = balances.find(
    (b) => b.employeeId === emp.id && b.type === "Annual"
  );
  if (!annual) return null;
  const remaining = annual.remaining;
  const rate = employeeDailyCost(emp);
  if (rate == null) return null;
  // Work in hundredths so half-cent ties match Excel's ROUND, including
  // negative balances, without binary floating-point rounding drift.
  const product = Math.round(remaining * 100) * Math.round(rate * 100);
  return Math.sign(product) * Math.round(Math.abs(product) / 100) / 100;
}

/** Rand value of accrued-but-untaken annual leave across the company. */
export function leaveLiabilityR(
  employees: Employee[],
  balances: LeaveBalance[]
): number {
  return employees.reduce(
    (sum, emp) => sum + (employeeAnnualLiabilityR(emp, balances) ?? 0),
    0
  );
}

/**
 * Estimated Rand cost of leave taken in a date window for one employee
 * (or all if empId omitted). Excludes Cancelled & Rejected.
 */
export function ytdLeaveCostR(
  requests: LeaveRequest[],
  employees: Employee[],
  fromIso: string,
  toIso: string,
  empId?: string
): number {
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  return requests
    .filter(
      (r) =>
        r.status !== "Cancelled" &&
        r.status !== "Rejected" &&
        r.startDate >= fromIso &&
        r.startDate <= toIso &&
        (empId ? r.employeeId === empId : true)
    )
    .reduce(
      (sum, r) => sum + r.days * (employeeDailyCost(byId[r.employeeId]) ?? 0),
      0
    );
}

/** Estimated Rand cost of requests awaiting payroll export (Approved). */
export function payrollQueueCostR(
  requests: LeaveRequest[],
  employees: Employee[]
): number {
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  return requests
    .filter((r) => r.status === "Approved")
    .reduce(
      (sum, r) => sum + r.days * (employeeDailyCost(byId[r.employeeId]) ?? 0),
      0
    );
}

export function formatRand(v: number): string {
  return "R" + v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, " ");
}
