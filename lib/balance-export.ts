import ExcelJS from "exceljs";
import type { Employee, LeaveBalance, LeaveType } from "./types";
import { todayIso } from "./holidays";

export const BALANCE_EXPORT_LEAVE_TYPES = [
  "Annual",
  "Sick",
  "Family Responsibility",
] as const satisfies readonly LeaveType[];

export type BalanceExportLeaveType = (typeof BALANCE_EXPORT_LEAVE_TYPES)[number];

export type BalanceExportRow = {
  employeeNo: string;
  name: string;
  department: string;
  role: string;
  annualEntitled: number | null;
  annualTaken: number | null;
  annualRemaining: number | null;
  sickEntitled: number | null;
  sickTaken: number | null;
  sickRemaining: number | null;
  familyEntitled: number | null;
  familyTaken: number | null;
  familyRemaining: number | null;
  monthlyAccrual: number | null;
  openingBalanceAsOf: string | null;
  dailyCostR: number | null | undefined;
};

function balanceFor(
  balances: LeaveBalance[],
  employeeId: string,
  type: LeaveBalance["type"]
): LeaveBalance | undefined {
  return balances.find((row) => row.employeeId === employeeId && row.type === type);
}

export function parseBalanceExportLeaveType(value: string | null | undefined): BalanceExportLeaveType | null {
  const trimmed = value?.trim();
  return BALANCE_EXPORT_LEAVE_TYPES.includes(trimmed as BalanceExportLeaveType)
    ? (trimmed as BalanceExportLeaveType)
    : null;
}

export function buildBalanceExportRows(
  employees: Employee[],
  balances: LeaveBalance[]
): BalanceExportRow[] {
  return [...employees]
    .sort((a, b) => a.name.localeCompare(b.name) || a.employeeNo.localeCompare(b.employeeNo))
    .map((employee) => {
      const annual = balanceFor(balances, employee.id, "Annual");
      const sick = balanceFor(balances, employee.id, "Sick");
      const family = balanceFor(balances, employee.id, "Family Responsibility");
      return {
        employeeNo: employee.employeeNo,
        name: employee.name,
        department: employee.department,
        role: employee.role,
        annualEntitled: annual?.entitled ?? null,
        annualTaken: annual?.taken ?? null,
        annualRemaining: annual?.remaining ?? null,
        sickEntitled: sick?.entitled ?? null,
        sickTaken: sick?.taken ?? null,
        sickRemaining: sick?.remaining ?? null,
        familyEntitled: family?.entitled ?? null,
        familyTaken: family?.taken ?? null,
        familyRemaining: family?.remaining ?? null,
        monthlyAccrual: employee.monthlyAccrual ?? null,
        openingBalanceAsOf: employee.openingBalanceAsOf?.slice(0, 10) ?? null,
        dailyCostR: employee.dailyCostR,
      };
    });
}

function leaveTypeColumns(leaveType: BalanceExportLeaveType | null): Partial<ExcelJS.Column>[] {
  const annual = [
    { header: "Annual entitled", key: "annualEntitled", width: 15 },
    { header: "Annual taken", key: "annualTaken", width: 13 },
    { header: "Annual remaining", key: "annualRemaining", width: 16 },
  ];
  const sick = [
    { header: "Sick entitled", key: "sickEntitled", width: 13 },
    { header: "Sick taken", key: "sickTaken", width: 12 },
    { header: "Sick remaining", key: "sickRemaining", width: 14 },
  ];
  const family = [
    { header: "Family entitled", key: "familyEntitled", width: 14 },
    { header: "Family taken", key: "familyTaken", width: 13 },
    { header: "Family remaining", key: "familyRemaining", width: 16 },
  ];
  if (leaveType === "Annual") return annual;
  if (leaveType === "Sick") return sick;
  if (leaveType === "Family Responsibility") return family;
  return [...annual, ...sick, ...family];
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function buildBalanceWorkbook(
  rows: BalanceExportRow[],
  options: {
    includeFinance: boolean;
    department?: string | null;
    leaveType?: BalanceExportLeaveType | null;
    asOf?: string;
  }
): Promise<ArrayBuffer> {
  const asOf = options.asOf ?? todayIso();
  const leaveType = options.leaveType ?? null;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vacate";
  workbook.created = new Date(`${asOf}T00:00:00Z`);

  const sheet = workbook.addWorksheet("Leave balances", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const columns: Partial<ExcelJS.Column>[] = [
    { header: "Employee no", key: "employeeNo", width: 14 },
    { header: "Name", key: "name", width: 28 },
    { header: "Department", key: "department", width: 22 },
    { header: "Role", key: "role", width: 22 },
    ...leaveTypeColumns(leaveType),
    { header: "Monthly accrual", key: "monthlyAccrual", width: 15 },
    { header: "Opening as of", key: "openingBalanceAsOf", width: 14 },
  ];
  if (options.includeFinance) {
    columns.push({ header: "Day rate (R)", key: "dailyCostR", width: 13 });
  }
  sheet.columns = columns;

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };

  for (const row of rows) {
    const values: Record<string, string | number | null> = {
      employeeNo: row.employeeNo,
      name: row.name,
      department: row.department,
      role: row.role,
      monthlyAccrual: row.monthlyAccrual,
      openingBalanceAsOf: row.openingBalanceAsOf,
    };
    if (!leaveType || leaveType === "Annual") {
      values.annualEntitled = row.annualEntitled;
      values.annualTaken = row.annualTaken;
      values.annualRemaining = row.annualRemaining;
    }
    if (!leaveType || leaveType === "Sick") {
      values.sickEntitled = row.sickEntitled;
      values.sickTaken = row.sickTaken;
      values.sickRemaining = row.sickRemaining;
    }
    if (!leaveType || leaveType === "Family Responsibility") {
      values.familyEntitled = row.familyEntitled;
      values.familyTaken = row.familyTaken;
      values.familyRemaining = row.familyRemaining;
    }
    if (options.includeFinance) values.dailyCostR = row.dailyCostR ?? null;
    sheet.addRow(values);
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };

  const meta = workbook.addWorksheet("Export info");
  meta.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 40 },
  ];
  meta.getRow(1).font = { bold: true };
  meta.addRow({ field: "As of", value: asOf });
  meta.addRow({ field: "Employees", value: rows.length });
  meta.addRow({
    field: "Department filter",
    value: options.department?.trim() || "All departments",
  });
  meta.addRow({
    field: "Leave type filter",
    value: leaveType || "All leave types",
  });
  meta.addRow({
    field: "Finance columns",
    value: options.includeFinance ? "Included" : "Hidden",
  });

  return workbook.xlsx.writeBuffer();
}

export function balanceExportFilename(
  department?: string | null,
  leaveType?: BalanceExportLeaveType | null,
  asOf = todayIso()
): string {
  const parts = [
    "leave-balances",
    department?.trim() ? slugPart(department) : "all-staff",
    leaveType ? slugPart(leaveType) : null,
    asOf,
  ].filter(Boolean);
  return `${parts.join("-")}.xlsx`;
}
