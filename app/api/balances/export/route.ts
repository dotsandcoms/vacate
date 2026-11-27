import { NextRequest, NextResponse } from "next/server";
import {
  balanceExportFilename,
  buildBalanceExportRows,
  buildBalanceWorkbook,
} from "@/lib/balance-export";
import { canAccessPayroll, scopeRequests } from "@/lib/auth";
import { computeBalances, getEmployees, getLeaveRequests } from "@/lib/data";
import { todayIso } from "@/lib/holidays";
import { authorizeApi } from "@/lib/security";
import { activeEmployees } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authorizeApi();
  if (auth.response) return auth.response;

  const departmentParam = request.nextUrl.searchParams.get("department")?.trim() || null;
  const asOf = todayIso();

  try {
    const [allStaff, allRequests] = await Promise.all([
      getEmployees(),
      getLeaveRequests({ allDates: true }),
    ]);
    const scoped = scopeRequests(auth.user!, activeEmployees(allStaff), allRequests);
    const departments = new Set(scoped.employees.map((employee) => employee.department));
    const department =
      departmentParam && departments.has(departmentParam) ? departmentParam : null;

    const employees = department
      ? scoped.employees.filter((employee) => employee.department === department)
      : scoped.employees;
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const requests = scoped.requests.filter((row) => employeeIds.has(row.employeeId));
    const balances = computeBalances(employees, requests);
    const rows = buildBalanceExportRows(employees, balances);
    const includeFinance = canAccessPayroll(auth.user!);
    const buffer = await buildBalanceWorkbook(rows, { includeFinance, department, asOf });
    const filename = balanceExportFilename(department, asOf);

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[vacate] Leave balance export failed", error);
    return NextResponse.json({ error: "Unable to export leave balances." }, { status: 500 });
  }
}
