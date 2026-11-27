import { NextRequest, NextResponse } from "next/server";
import {
  balanceExportFilename,
  buildBalanceExportRows,
  buildBalanceWorkbook,
  parseBalanceExportLeaveType,
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
  const leaveType = parseBalanceExportLeaveType(request.nextUrl.searchParams.get("leaveType"));
  const asOf = todayIso();

  try {
    const [allStaff, allRequests] = await Promise.all([
      getEmployees(),
      getLeaveRequests({ allDates: true }),
    ]);
    const scoped = scopeRequests(auth.user!, activeEmployees(allStaff), allRequests);
    const departmentMatch = departmentParam
      ? scoped.employees.find(
          (employee) => employee.department.toLowerCase() === departmentParam.toLowerCase()
        )?.department ?? null
      : null;

    const employees = departmentMatch
      ? scoped.employees.filter((employee) => employee.department === departmentMatch)
      : scoped.employees;
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const requests = scoped.requests.filter((row) => employeeIds.has(row.employeeId));
    const balances = computeBalances(employees, requests);
    const rows = buildBalanceExportRows(employees, balances);
    const includeFinance = canAccessPayroll(auth.user!);
    const buffer = await buildBalanceWorkbook(rows, {
      includeFinance,
      department: departmentMatch,
      leaveType,
      asOf,
    });
    const filename = balanceExportFilename(departmentMatch, leaveType, asOf);

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
