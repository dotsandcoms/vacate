import Link from "next/link";
import { Suspense } from "react";
import CoverageClashes from "@/components/CoverageClashes";
import DashboardAccordion from "@/components/DashboardAccordion";
import DashboardCharts from "@/components/DashboardCharts";
import DepartmentFilter from "@/components/DepartmentFilter";
import LeaveTypeFilter from "@/components/LeaveTypeFilter";
import NotificationBell from "@/components/NotificationBell";
import EmployeeSearch from "@/components/EmployeeSearch";
import Avatar from "@/components/Avatar";
import {
  computeBalances,
  getEmployees,
  getLeaveRequests,
  activeSource,
} from "@/lib/data";
import {
  employeeAnnualLiabilityR,
  formatRand,
  leaveLiabilityR,
  payrollQueueCostR,
  ytdLeaveCostR,
} from "@/lib/balances";
import { activeEmployees, statusStyles } from "@/lib/utils";
import { config } from "@/lib/config";
import {
  addDaysIso,
  humanDate,
  humanRange,
  isWorkingDay,
  todayIso,
} from "@/lib/holidays";
import {
  isTakenYtd,
  reportingFrom,
  reportingWindowLabel,
} from "@/lib/reporting";
import { requireUser, scopeRequests } from "@/lib/auth";
import { LeaveType } from "@/lib/types";

const DASHBOARD_LEAVE_TYPES: LeaveType[] = [
  "Annual",
  "Sick",
  "Family Responsibility",
];

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ department?: string; leaveType?: string }>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [allStaff, allRequests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);
  const scoped = scopeRequests(user, activeEmployees(allStaff), allRequests);
  const allEmployees = scoped.employees;
  const scopedRequests = scoped.requests;

  const departments = Array.from(
    new Set(allEmployees.map((e) => e.department).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const selectedDept = resolvedSearchParams?.department?.trim() || null;
  const department =
    selectedDept && departments.includes(selectedDept) ? selectedDept : null;

  const requestedLeaveType = resolvedSearchParams?.leaveType?.trim();
  const leaveType = DASHBOARD_LEAVE_TYPES.includes(
    requestedLeaveType as LeaveType
  )
    ? (requestedLeaveType as LeaveType)
    : null;

  const employees = department
    ? allEmployees.filter((e) => e.department === department)
    : allEmployees;
  const employeeIds = new Set(employees.map((e) => e.id));
  const departmentRequests = scopedRequests.filter((r) =>
    employeeIds.has(r.employeeId)
  );
  const requests = leaveType
    ? departmentRequests.filter((r) => r.type === leaveType)
    : departmentRequests;

  const balances = computeBalances(employees, departmentRequests);
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));

  const today = todayIso();
  const weekEnd = addDaysIso(today, 7);
  const active = requests.filter(
    (r) => r.status !== "Cancelled" && r.status !== "Rejected"
  );

  const onLeaveToday = active.filter(
    (r) => r.startDate <= today && r.endDate >= today
  );
  const outThisWeek = active
    .filter((r) => r.startDate <= weekEnd && r.endDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const awaitingApproval = requests.filter(
    (r) => r.status === "Awaiting Approval"
  );
  const pendingSync = requests.filter((r) => r.status === "Approved");
  const daysYtd = active
    .filter((r) => isTakenYtd(r.startDate, today))
    .reduce((s, r) => s + r.days, 0);
  const leaveDaysLogged = requests.reduce((s, r) => s + r.days, 0);

  const now = Date.now();
  const stuck = awaitingApproval
    .map((r) => ({
      ...r,
      waitingDays: r.submittedAt
        ? Math.floor((now - new Date(r.submittedAt).getTime()) / 86400000)
        : 0,
    }))
    .filter((r) => r.waitingDays >= config.approvalAgingDays)
    .sort((a, b) => b.waitingDays - a.waitingDays);
  const stuckVisibleLimit = 6;
  const visibleStuck = stuck.slice(0, stuckVisibleLimit);
  const hiddenStuckCount = stuck.length - visibleStuck.length;

  const clashes: {
    date: string;
    people: { id: string; name: string }[];
  }[] = [];
  for (let i = 0; i < 60; i++) {
    const d = addDaysIso(today, i);
    if (!isWorkingDay(d)) continue;
    const out = active.filter((r) => r.startDate <= d && r.endDate >= d);
    if (out.length >= config.clashThreshold) {
      const seen = new Set<string>();
      const people: { id: string; name: string }[] = [];
      for (const r of out) {
        if (seen.has(r.employeeId)) continue;
        seen.add(r.employeeId);
        people.push({
          id: r.employeeId,
          name: empById[r.employeeId]?.name ?? "Unknown",
        });
      }
      clashes.push({ date: d, people });
    }
  }

  const sickNoteMissing = active.filter(
    (r) =>
      r.type === "Sick" && r.days > config.sickNoteAfterDays && !r.hasAttachment
  );
  const sickNoteVisibleLimit = 6;
  const visibleSickNotes = sickNoteMissing.slice(0, sickNoteVisibleLimit);
  const hiddenSickNoteCount = sickNoteMissing.length - visibleSickNotes.length;

  const lowBalances = balances.filter(
    (b) => b.type === "Annual" && b.remaining <= config.lowBalanceDays
  );
  const lowBalanceVisibleLimit = 6;
  const visibleLowBalances = lowBalances.slice(0, lowBalanceVisibleLimit);
  const hiddenLowBalanceCount = lowBalances.length - visibleLowBalances.length;

  const departmentCount = new Set(employees.map((e) => e.department)).size;

  const heroStats: { label: string; value: string; href?: string }[] = [
    { label: "Total employees", value: String(employees.length) },
    {
      label: department ? "Department" : "Departments",
      value: department ? "1" : String(departmentCount),
    },
    { label: "On leave today", value: String(onLeaveToday.length) },
    {
      label: "Awaiting approval",
      value: String(awaitingApproval.length),
      href: "/register",
    },
    {
      label: "Awaiting payroll",
      value: String(pendingSync.length),
      href: "/exports",
    },
    { label: "Days taken YTD", value: String(daysYtd) },
  ];

  const isLive = activeSource !== "mock";
  const accruedLiability = leaveLiabilityR(employees, balances);
  const ytdCost = ytdLeaveCostR(requests, employees, reportingFrom(), today);
  const payrollCost = payrollQueueCostR(pendingSync, employees);
  const topLiability = employees
    .map((emp) => {
      const annual = balances.find(
        (b) => b.employeeId === emp.id && b.type === "Annual"
      );
      const liability = employeeAnnualLiabilityR(emp, balances);
      return {
        employeeId: emp.id,
        name: emp.name,
        remaining: annual?.remaining ?? 0,
        liability,
      };
    })
    .filter((r) => r.liability > 0)
    .sort((a, b) => b.liability - a.liability)
    .slice(0, 8);
  const costDisclaimer = `Estimated · avg ${formatRand(config.avgDailyCostR)}/day until payroll salaries import`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink-900">
            {humanDate(today)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {department ? (
              <>
                <span className="font-medium text-ink-800">{department}</span>
                {" · "}
              </>
            ) : null}
            {leaveType ? (
              <>
                <span className="font-medium text-ink-800">{leaveType}</span>
                {" leave · "}
              </>
            ) : null}
            {employees.length} staff · {leaveDaysLogged} leave days ·{" "}
            {reportingWindowLabel()}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <Suspense
            fallback={
              <div className="h-9 w-44 rounded-xl border border-white/60 bg-white/50" />
            }
          >
            <DepartmentFilter
              departments={departments}
              selected={department}
            />
            <LeaveTypeFilter
              leaveTypes={DASHBOARD_LEAVE_TYPES}
              selected={leaveType}
            />
          </Suspense>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium shadow-panel backdrop-blur-md ${
              isLive ? "text-slate-600" : "border-amber-200/80 text-amber-700"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isLive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  isLive ? "bg-brand-500" : "bg-amber-500"
                }`}
              />
            </span>
            {activeSource === "both"
              ? "Supabase history + Kissflow live sync"
              : activeSource === "supabase"
              ? "Supabase (history + Kissflow sync)"
              : activeSource === "kissflow"
              ? "utf.kissflow.com"
              : "Sample data — Supabase not connected"}
          </span>
          <EmployeeSearch employees={allEmployees} />
          {(user.role === "admin" || user.role === "cfo") && <NotificationBell />}
        </div>
      </header>

      <DashboardAccordion
        id="overview"
        title="Overview"
        description="Key leave totals at a glance"
        animationOrder={0}
        contentClassName=""
      >
        <div className="grid grid-cols-2 divide-x-0 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
          {heroStats.map((s) => {
            const inner = (
              <div className="px-5 py-4">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label mt-1.5">{s.label}</div>
              </div>
            );
            return s.href ? (
              <Link
                key={s.label}
                href={s.href}
                className="transition-colors hover:bg-slate-50/80"
              >
                {inner}
              </Link>
            ) : (
              <div key={s.label}>{inner}</div>
            );
          })}
        </div>
      </DashboardAccordion>

      <DashboardAccordion
        id="finance"
        title="Finance (estimated)"
        description="Cost-to-company of leave — directional only"
        headerAside={
          <p className="hidden text-[11px] text-slate-400 xl:block">
            {costDisclaimer}
          </p>
        }
        animationOrder={1}
      >
        <p className="mb-4 text-[11px] text-slate-400 xl:hidden">
          {costDisclaimer}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white/50 px-4 py-3">
            <div className="stat-label">Accrued annual liability</div>
            <div className="stat-value mt-1">{formatRand(accruedLiability)}</div>
            <p className="mt-1 text-xs text-slate-400">
              Untaken annual days × day rate
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white/50 px-4 py-3">
            <div className="stat-label">YTD leave cost</div>
            <div className="stat-value mt-1">{formatRand(ytdCost)}</div>
            <p className="mt-1 text-xs text-slate-400">
              {daysYtd} leave days · {reportingWindowLabel()}
            </p>
          </div>
          <Link
            href="/exports"
            className="rounded-xl border border-slate-100 bg-white/50 px-4 py-3 transition-colors hover:bg-slate-50/80"
          >
            <div className="stat-label">Awaiting payroll</div>
            <div className="stat-value mt-1">{formatRand(payrollCost)}</div>
            <p className="mt-1 text-xs text-slate-400">
              {pendingSync.length} approved request
              {pendingSync.length === 1 ? "" : "s"} in queue
            </p>
          </Link>
        </div>
        {topLiability.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Highest accrued liability
            </h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {topLiability.map((row) => (
                <li
                  key={row.employeeId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <Link
                          href={`/employee/${row.employeeId}`}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {row.name}
                        </Link>
                      </p>
                      <p className="text-xs text-slate-400">
                        {row.remaining} annual day
                        {row.remaining === 1 ? "" : "s"} left
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-ink-800">
                    {formatRand(row.liability)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DashboardAccordion>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DashboardAccordion
            id="out-this-week"
            title="Out this week"
            description="Approved and pending leave in the next 7 days"
            animationOrder={2}
          >
            {outThisWeek.length === 0 ? (
              <p className="py-4 text-sm text-slate-400">
                Full house — nobody
                {department ? ` in ${department}` : ""} is on approved or
                pending leave in the next 7 days.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {outThisWeek.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={empById[r.employeeId]?.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          <Link
                            href={`/employee/${r.employeeId}`}
                            className="hover:text-brand-600 hover:underline"
                          >
                            {empById[r.employeeId]?.name}
                          </Link>
                          <span className="font-normal text-slate-400">
                            {" "}
                            · {r.type}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {humanRange(r.startDate, r.endDate)} · {r.days} day
                          {r.days === 1 ? "" : "s"}
                          {r.notes ? ` · ${r.notes}` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusStyles[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardAccordion>

          <DashboardAccordion
            id="coverage-clashes"
            title="Coverage clashes"
            description={`Working days in the next 60 with ${config.clashThreshold}+ staff out at once`}
            headerAside={
              <Link
                href="/calendar"
                className="hidden shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 sm:block"
              >
                Open calendar
              </Link>
            }
            animationOrder={4}
          >
            <CoverageClashes clashes={clashes} />
          </DashboardAccordion>

          <DashboardCharts
            key={`${department ?? "all"}:${leaveType ?? "all"}`}
            requests={requests}
            throughDate={today}
            animationOrder={6}
          />
        </div>

        <div className="space-y-4">
          <DashboardAccordion
            id="stuck-approvals"
            title="Stuck approvals"
            description={`Waiting longer than ${config.approvalAgingDays} days`}
            animationOrder={3}
          >
            {stuck.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nothing waiting longer than {config.approvalAgingDays} days.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleStuck.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-2.5">
                    <Avatar name={empById[r.employeeId]?.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <Link
                          href={`/employee/${r.employeeId}`}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {empById[r.employeeId]?.name}
                        </Link>
                      </p>
                      <p className="text-xs text-slate-500">
                        {humanRange(r.startDate, r.endDate)} · waiting{" "}
                        <span className="font-medium text-amber-700">
                          {r.waitingDays} days
                        </span>
                        {r.currentAssignee ? ` with ${r.currentAssignee}` : ""}
                        {r.currentStep ? ` (${r.currentStep})` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {hiddenStuckCount > 0 && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Showing {stuckVisibleLimit} of {stuck.length}.{" "}
                <Link
                  href="/register"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Open leave register ({hiddenStuckCount} more)
                </Link>
              </p>
            )}
          </DashboardAccordion>

          <DashboardAccordion
            id="sick-notes"
            title="Sick notes outstanding"
            description="Medical certificates requiring attention"
            animationOrder={5}
          >
            {sickNoteMissing.length === 0 ? (
              <p className="text-sm text-slate-400">
                All sick leave over {config.sickNoteAfterDays} days has a
                certificate attached.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {visibleSickNotes.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 py-2.5">
                      <Avatar name={empById[r.employeeId]?.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          <Link
                            href={`/employee/${r.employeeId}`}
                            className="hover:text-brand-600 hover:underline"
                          >
                            {empById[r.employeeId]?.name}
                          </Link>
                        </p>
                        <p className="text-xs text-slate-500">
                          {humanRange(r.startDate, r.endDate)} · {r.days} days
                          sick, no certificate — BCEA requires one
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {hiddenSickNoteCount > 0 && (
                  <Link
                    href="/register"
                    className="mt-2 block text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    +{hiddenSickNoteCount} more in Leave Register
                  </Link>
                )}
              </>
            )}
          </DashboardAccordion>

          <DashboardAccordion
            id="low-balances"
            title="Low annual balances"
            description={`Staff with ${config.lowBalanceDays} days or fewer remaining`}
            animationOrder={8}
          >
            {lowBalances.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nobody under {config.lowBalanceDays} days accrued.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {visibleLowBalances.map((b) => (
                    <li
                      key={b.employeeId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={empById[b.employeeId]?.name} />
                        <p className="truncate text-sm font-medium">
                          <Link
                            href={`/employee/${b.employeeId}`}
                            className="hover:text-brand-600 hover:underline"
                          >
                            {empById[b.employeeId]?.name}
                          </Link>
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-500">
                        {b.remaining} of {b.entitled} left
                      </p>
                    </li>
                  ))}
                </ul>
                {hiddenLowBalanceCount > 0 && (
                  <Link
                    href="/register"
                    className="mt-2 block text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    +{hiddenLowBalanceCount} more in Leave Register
                  </Link>
                )}
              </>
            )}
          </DashboardAccordion>
        </div>
      </div>
    </div>
  );
}
