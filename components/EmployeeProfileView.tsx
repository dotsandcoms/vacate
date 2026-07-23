import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  FileText,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { statusStyles, typeColors } from "@/lib/utils";
import { humanDate, humanRange } from "@/lib/holidays";
import { Employee, LeaveBalance, LeaveRequest } from "@/lib/types";

type Props = {
  employee: Employee;
  balances: LeaveBalance[];
  history: LeaveRequest[];
  daysYtd: number;
  daysAllTime: number;
  sickNoteGaps: LeaveRequest[];
  annualRemaining: number | null;
  annualEntitled: number | null;
  onLeaveNow: LeaveRequest | null;
  upcoming: LeaveRequest[];
};

/**
 * Employee profile — balances, summary, upcoming leave, full Kissflow history.
 */
export default function EmployeeProfileView({
  employee,
  balances,
  history,
  daysYtd,
  daysAllTime,
  sickNoteGaps,
  annualRemaining,
  annualEntitled,
  onLeaveNow,
  upcoming,
}: Props) {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Hero */}
      <header className="panel panel-pad">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4 sm:items-center">
            <Avatar name={employee.name} size="lg" />
            <div>
              <p className="eyebrow text-brand-700">{employee.employeeNo}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                {employee.name}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {employee.department} · {employee.role}
              </p>
              {onLeaveNow && (
                <p className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-600/20">
                  On {onLeaveNow.type.toLowerCase()} ·{" "}
                  {humanRange(onLeaveNow.startDate, onLeaveNow.endDate)}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/55 px-5 py-4 backdrop-blur-sm sm:min-w-[11rem] sm:text-right">
            <div className="stat-label">Annual days left</div>
            <div className="stat-value mt-1">
              {annualRemaining ?? "—"}
              <span className="text-base font-sans font-normal text-slate-400">
                /{annualEntitled ?? "—"}
              </span>
            </div>
            {employee.openingBalanceAsOf ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Excel baseline {employee.openingBalanceAsOf}
                {employee.openingAnnualBalance != null
                  ? ` · opened at ${employee.openingAnnualBalance}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* Balances */}
      <section>
        <div className="mb-3">
          <h2 className="section-title">Balances</h2>
          <p className="mt-1 text-sm text-slate-500">
            Remaining / entitled this cycle
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {balances.map((b) => {
            const pct =
              b.entitled > 0
                ? Math.min(100, Math.round((b.remaining / b.entitled) * 100))
                : 0;
            const color = typeColors[b.type] ?? "#94a3b8";
            return (
              <div
                key={b.type}
                className="panel panel-pad-sm transition hover:bg-white/80"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="stat-label normal-case tracking-normal">
                    {b.type}
                  </span>
                </div>
                <div className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink-900">
                  {b.remaining}
                  <span className="text-sm font-sans font-normal text-slate-400">
                    /{b.entitled}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {b.taken} taken this cycle
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Requests",
            value: history.length,
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: "Days YTD",
            value: daysYtd,
            icon: <CalendarDays className="h-4 w-4" />,
          },
          {
            label: "Days all-time",
            value: daysAllTime,
            icon: <FileText className="h-4 w-4" />,
          },
        ].map((s) => (
          <div key={s.label} className="panel panel-pad-sm flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/80 text-slate-600">
              {s.icon}
            </span>
            <div>
              <div className="font-display text-xl font-semibold tabular-nums text-ink-900">
                {s.value}
              </div>
              <div className="stat-label mt-0.5 normal-case tracking-normal">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sickNoteGaps.length > 0 && (
        <section className="panel panel-pad flex gap-4 border-amber-200/70 bg-amber-50/70">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              Sick notes outstanding
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-900/80">
              {sickNoteGaps.map((r) => (
                <li key={r.id}>
                  {humanRange(r.startDate, r.endDate)} · {r.days} days — no
                  certificate attached (BCEA)
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="panel panel-pad">
          <h2 className="section-title">Upcoming leave</h2>
          <p className="mt-1 text-sm text-slate-500">
            Approved or pending leave still ahead
          </p>
          <ul className="mt-4 space-y-2">
            {upcoming.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/50 bg-white/45 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: typeColors[r.type] ?? "#94a3b8",
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {r.type}
                      <span className="ml-2 font-normal text-slate-500">
                        {humanRange(r.startDate, r.endDate)} · {r.days}d
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">{r.kissflowId}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusStyles[r.status]}`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Leave movements */}
      <section className="panel panel-pad">
        <div className="mb-5">
          <h2 className="section-title">Leave movements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Full history synced from Kissflow
          </p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-5 py-10 text-center text-sm text-slate-400">
            No leave history recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100/80">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex gap-3">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: typeColors[r.type] ?? "#94a3b8",
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {r.type}
                      <span className="ml-2 font-normal text-slate-500">
                        {humanRange(r.startDate, r.endDate)} · {r.days} day
                        {r.days === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Kissflow {r.kissflowId}
                      {r.approvedBy ? ` · actioned by ${r.approvedBy}` : ""}
                      {r.approvedAt
                        ? ` · ${humanDate(r.approvedAt.slice(0, 10))}`
                        : ""}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                    {r.status === "Rejected" && r.rejectionReason && (
                      <p className="mt-2 text-xs text-red-600">
                        Rejected{r.rejectedBy ? ` by ${r.rejectedBy}` : ""}:{" "}
                        {r.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusStyles[r.status]}`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
