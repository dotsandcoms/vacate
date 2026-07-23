import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { computeBalances, getEmployees, getLeaveRequests } from "@/lib/data";
import { statusStyles, typeColors } from "@/lib/utils";
import { humanRange, todayIso } from "@/lib/holidays";
import { config } from "@/lib/config";
import Avatar from "@/components/Avatar";

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

  return (
    <div className="space-y-6">
      <Link
        href="/register"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Leave Register
      </Link>

      <header className="panel panel-pad flex items-center gap-4">
        <Avatar name={employee.name} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-medium text-ink-900">
            {employee.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {employee.employeeNo} · {employee.department} · {employee.role}
          </p>
        </div>
      </header>

      {/* Balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {balances.map((b) => (
          <div key={b.type} className="panel panel-pad">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: typeColors[b.type] ?? "#94a3b8" }}
              />
              <span className="stat-label">{b.type}</span>
            </div>
            <div className="mt-2 stat-value">
              {b.remaining}
              <span className="text-base font-sans font-normal text-slate-400">
                {" "}
                / {b.entitled}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {b.taken} taken so far this cycle
            </div>
          </div>
        ))}
      </div>

      {/* Summary strip */}
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className="px-5 py-4">
            <div className="stat-value text-xl">{history.length}</div>
            <div className="stat-label mt-1">Total requests</div>
          </div>
          <div className="px-5 py-4">
            <div className="stat-value text-xl">{daysYtd}</div>
            <div className="stat-label mt-1">Days taken YTD</div>
          </div>
          <div className="px-5 py-4">
            <div className="stat-value text-xl">{daysAllTime}</div>
            <div className="stat-label mt-1">Days taken all-time</div>
          </div>
        </div>
      </div>

      {sickNoteGaps.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">
            Sick notes outstanding
          </h2>
          <ul className="text-sm text-amber-800 space-y-1">
            {sickNoteGaps.map((r) => (
              <li key={r.id}>
                {humanRange(r.startDate, r.endDate)} · {r.days} days — no
                certificate attached, BCEA requires one
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Full history */}
      <section className="panel overflow-hidden">
        <h2 className="section-title px-5 pt-4 pb-3">Leave history</h2>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="text-left eyebrow">
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Dates</th>
              <th className="px-5 py-3 text-right">Days</th>
              <th className="px-5 py-3">Kissflow ref</th>
              <th className="px-5 py-3">Actioned by</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {history.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: typeColors[r.type] ?? "#94a3b8" }}
                    />
                    {r.type}
                  </span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  {humanRange(r.startDate, r.endDate)}
                </td>
                <td className="px-5 py-3 text-right font-medium">{r.days}</td>
                <td className="px-5 py-3 text-slate-500">{r.kissflowId}</td>
                <td className="px-5 py-3 text-slate-500">
                  {r.status === "Rejected" && r.rejectedBy
                    ? r.rejectedBy
                    : r.approvedBy}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusStyles[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  No leave history recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
