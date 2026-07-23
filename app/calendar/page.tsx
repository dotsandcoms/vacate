import TeamCalendar from "@/components/TeamCalendar";
import { getEmployees, getLeaveRequests } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [employees, requests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Who is out, when — spot overlaps before they hurt
        </p>
      </header>
      <TeamCalendar employees={employees} requests={requests} />
    </div>
  );
}
