import { notFound } from "next/navigation";
import EmployeeProfileView from "@/components/EmployeeProfileView";
import { computeBalances, getEmployees, getLeaveRequests } from "@/lib/data";
import { todayIso } from "@/lib/holidays";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function EmployeeProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const [employees, requests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);

  const employee = employees.find((e) => e.id === params.id);
  if (!employee) notFound();

  const balances = computeBalances(employees, requests).filter(
    (b) => b.employeeId === employee.id
  );
  const history = requests
    .filter((r) => r.employeeId === employee.id)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const today = todayIso();
  const active = history.filter(
    (r) => r.status !== "Cancelled" && r.status !== "Rejected"
  );
  const daysYtd = active
    .filter((r) => r.startDate.startsWith(today.slice(0, 4)))
    .reduce((s, r) => s + r.days, 0);
  const daysAllTime = active.reduce((s, r) => s + r.days, 0);
  const sickNoteGaps = active.filter(
    (r) =>
      r.type === "Sick" && r.days > config.sickNoteAfterDays && !r.hasAttachment
  );
  const annual = balances.find((b) => b.type === "Annual");
  const onLeaveNow =
    active.find((r) => r.startDate <= today && r.endDate >= today) ?? null;
  const upcoming = active
    .filter((r) => r.endDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  return (
    <EmployeeProfileView
      employee={employee}
      balances={balances}
      history={history}
      daysYtd={daysYtd}
      daysAllTime={daysAllTime}
      sickNoteGaps={sickNoteGaps}
      annualRemaining={annual?.remaining ?? null}
      annualEntitled={annual?.entitled ?? null}
      onLeaveNow={onLeaveNow}
      upcoming={upcoming}
    />
  );
}
