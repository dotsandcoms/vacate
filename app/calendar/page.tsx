import TeamCalendar from "@/components/TeamCalendar";
import { getEmployees, getLeaveRequests } from "@/lib/data";
import { reportingWindowLabel } from "@/lib/reporting";
import { activeEmployees } from "@/lib/utils";
import { requireUser, scopeRequests } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser();
  const [allEmployees, allRequests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);
  const scoped = scopeRequests(user, activeEmployees(allEmployees), allRequests);
  const employees = scoped.employees;
  const requests = scoped.requests;
  const activeIds = new Set(employees.map((e) => e.id));
  const activeRequests = requests.filter((r) => activeIds.has(r.employeeId));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Who is out, when — spot overlaps before they hurt ·{" "}
          {reportingWindowLabel()}
        </p>
      </header>
      <TeamCalendar employees={employees} requests={activeRequests} />
    </div>
  );
}
