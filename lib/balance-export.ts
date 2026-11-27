import ExcelJS from "exceljs";
import type { Employee, LeaveBalance } from "./types";
import { todayIso } from "./holidays";

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

export async function buildBalanceWorkbook(
  rows: BalanceExportRow[],
  options: { includeFinance: boolean; department?: string | null; asOf?: string }
): Promise<ArrayBuffer> {
  const asOf = options.asOf ?? todayIso();
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
    { header: "Annual entitled", key: "annualEntitled", width: 15 },
    { header: "Annual taken", key: "annualTaken", width: 13 },
    { header: "Annual remaining", key: "annualRemaining", width: 16 },
    { header: "Sick entitled", key: "sickEntitled", width: 13 },
    { header: "Sick taken", key: "sickTaken", width: 12 },
    { header: "Sick remaining", key: "sickRemaining", width: 14 },
    { header: "Family entitled", key: "familyEntitled", width: 14 },
    { header: "Family taken", key: "familyTaken", width: 13 },
    { header: "Family remaining", key: "familyRemaining", width: 16 },
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
      annualEntitled: row.annualEntitled,
      annualTaken: row.annualTaken,
      annualRemaining: row.annualRemaining,
      sickEntitled: row.sickEntitled,
      sickTaken: row.sickTaken,
      sickRemaining: row.sickRemaining,
      familyEntitled: row.familyEntitled,
      familyTaken: row.familyTaken,
      familyRemaining: row.familyRemaining,
      monthlyAccrual: row.monthlyAccrual,
      openingBalanceAsOf: row.openingBalanceAsOf,
    };
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
    field: "Finance columns",
    value: options.includeFinance ? "Included" : "Hidden",
  });

  return workbook.xlsx.writeBuffer();
}

export function balanceExportFilename(department?: string | null, asOf = todayIso()): string {
  const scope = department?.trim()
    ? department.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "all-staff";
  return `leave-balances-${scope}-${asOf}.xlsx`;
}
