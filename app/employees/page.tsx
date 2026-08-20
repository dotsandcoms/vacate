import EmployeeDirectory from "@/components/EmployeeDirectory";
import { getEmployees } from "@/lib/data";
import { requireUser, scopeEmployees } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requireUser();
  const employees = scopeEmployees(user, await getEmployees());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm text-slate-500">
          Full staff list. Mark people who have left as inactive so they drop
          off the dashboard, calendar, and payroll views.
        </p>
      </header>
      <EmployeeDirectory employees={employees} />
    </div>
  );
}
