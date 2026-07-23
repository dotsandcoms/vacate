"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  startOfMonth,
} from "date-fns";
import { Employee, LeaveRequest } from "@/lib/types";
import { typeColors } from "@/lib/utils";
import Avatar from "./Avatar";

export default function TeamCalendar({
  employees,
  requests,
}: {
  employees: Employee[];
  requests: LeaveRequest[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [onlyWithLeave, setOnlyWithLeave] = useState(false);

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(employees.map((e) => e.department))).sort()],
    [employees]
  );

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month]
  );

  const active = useMemo(
    () => requests.filter((r) => r.status !== "Cancelled"),
    [requests]
  );

  // Employees with at least one active request overlapping the visible month.
  const employeesWithLeaveThisMonth = useMemo(() => {
    const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
    const ids = new Set<string>();
    for (const r of active) {
      if (r.startDate <= monthEnd && r.endDate >= monthStart) ids.add(r.employeeId);
    }
    return ids;
  }, [active, month]);

  const visibleEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (dept !== "All" && e.department !== dept) return false;
      if (onlyWithLeave && !employeesWithLeaveThisMonth.has(e.id)) return false;
      if (q && !`${e.name} ${e.employeeNo}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [employees, q, dept, onlyWithLeave, employeesWithLeaveThisMonth]);

  const isOut = (empId: string, day: Date) => {
    const d = format(day, "yyyy-MM-dd");
    return active.find(
      (r) => r.employeeId === empId && r.startDate <= d && r.endDate >= d
    );
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="panel flex h-9 w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink-900"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <span className="font-display w-40 text-center text-base font-medium text-ink-900">
          {format(month, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="panel flex h-9 w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink-900"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(typeColors).map(([name, color]) => (
            <span key={name} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or emp no…"
            className="input-base w-64 py-2 pl-9 pr-3"
          />
        </div>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="input-base py-2 pl-3 pr-8"
        >
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-panel">
          <input
            type="checkbox"
            checked={onlyWithLeave}
            onChange={(e) => setOnlyWithLeave(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          On leave this month
        </label>
        <span className="ml-auto text-xs text-slate-400">
          {visibleEmployees.length} of {employees.length} staff
        </span>
      </div>

      <div className="panel max-h-[70vh] overflow-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-48 bg-white/80 px-4 py-2.5 text-left font-medium text-slate-500 backdrop-blur-md">
                Employee
              </th>
              {days.map((d) => (
                <th
                  key={d.toISOString()}
                  className={`sticky top-0 z-10 w-8 bg-white/80 px-0.5 py-2 text-center font-normal backdrop-blur-md ${
                    isWeekend(d) ? "text-slate-300" : "text-slate-500"
                  } ${format(d, "yyyy-MM-dd") === todayStr ? "font-semibold text-brand-600" : ""}`}
                >
                  <div>{format(d, "EEEEE")}</div>
                  <div>{format(d, "d")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((emp) => (
              <tr key={emp.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white/80 px-4 py-2 backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={emp.name} />
                    <div>
                      <Link
                        href={`/employee/${emp.id}`}
                        className="font-medium text-[13px] hover:text-brand-600 hover:underline"
                      >
                        {emp.name}
                      </Link>
                      <div className="text-slate-400">{emp.department}</div>
                    </div>
                  </div>
                </td>
                {days.map((d) => {
                  const r = isOut(emp.id, d);
                  const weekend = isWeekend(d);
                  return (
                    <td key={d.toISOString()} className="p-0.5">
                      <div
                        title={r ? `${r.type}: ${r.startDate} → ${r.endDate}` : undefined}
                        className={`h-7 w-7 rounded ${weekend && !r ? "bg-slate-50" : ""}`}
                        style={
                          r
                            ? { backgroundColor: typeColors[r.type] ?? "#94a3b8", opacity: weekend ? 0.35 : 0.9 }
                            : undefined
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleEmployees.length === 0 && (
              <tr>
                <td
                  colSpan={days.length + 1}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  {onlyWithLeave
                    ? "Nobody has leave booked for this month."
                    : "No employees match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
