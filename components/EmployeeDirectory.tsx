"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Employee } from "@/lib/types";
import { isActiveEmployee } from "@/lib/utils";
import Avatar from "./Avatar";

type StatusFilter = "active" | "inactive" | "all";

export default function EmployeeDirectory({
  employees,
}: {
  employees: Employee[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [dept, setDept] = useState("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departments = useMemo(
    () =>
      [
        "All",
        ...Array.from(
          new Set(
            employees
              .map((e) => e.department)
              .filter((d) => d && d !== "—")
          )
        ).sort(),
      ],
    [employees]
  );

  const counts = useMemo(() => {
    const active = employees.filter(isActiveEmployee).length;
    return {
      active,
      inactive: employees.length - active,
      all: employees.length,
    };
  }, [employees]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees
      .filter((e) => {
        const isActive = isActiveEmployee(e);
        if (status === "active" && !isActive) return false;
        if (status === "inactive" && isActive) return false;
        if (dept !== "All" && e.department !== dept) return false;
        if (
          needle &&
          !`${e.name} ${e.employeeNo} ${e.department} ${e.role}`
            .toLowerCase()
            .includes(needle)
        )
          return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, q, status, dept]);

  const toggle = async (emp: Employee) => {
    setBusyId(emp.id);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emp.id,
          employeeNo: emp.employeeNo,
          active: !isActiveEmployee(emp),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not update status");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, emp no, department…"
            className="input-base w-full py-2 pl-9 pr-3 sm:w-72"
          />
        </div>
        <div className="inline-flex w-full rounded-xl bg-white/70 p-1 ring-1 ring-inset ring-white/80 sm:w-auto">
          {(["active", "inactive", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize sm:flex-none sm:py-1.5 ${
                status === s
                  ? "bg-ink-900 text-white"
                  : "text-slate-500 hover:text-ink-900"
              }`}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
        {departments.length > 1 && (
          <select
            className="input-base py-2 pl-3 pr-8 sm:w-auto"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        )}
        <span className="w-full text-xs text-slate-400 sm:ml-auto sm:w-auto">
          {rows.length} shown
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-600/20">
          {error}
        </div>
      )}

      <div className="panel max-h-[70vh] overflow-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="text-left eyebrow">
              <th className="sticky top-0 z-10 bg-white/80 px-5 py-3 backdrop-blur-md">
                Employee
              </th>
              <th className="sticky top-0 z-10 bg-white/80 px-5 py-3 backdrop-blur-md">
                Department
              </th>
              <th className="sticky top-0 z-10 hidden bg-white/80 px-5 py-3 backdrop-blur-md sm:table-cell">
                Role
              </th>
              <th className="sticky top-0 z-10 bg-white/80 px-5 py-3 backdrop-blur-md">
                Status
              </th>
              <th className="sticky top-0 z-10 bg-white/80 px-5 py-3 text-right backdrop-blur-md">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((e) => {
              const active = isActiveEmployee(e);
              return (
                <tr
                  key={e.id}
                  className={active ? "hover:bg-slate-50/60" : "bg-slate-50/40"}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} />
                      <div>
                        <Link
                          href={`/employee/${e.id}`}
                          className="font-medium hover:text-brand-600 hover:underline"
                        >
                          {e.name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {e.employeeNo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{e.department}</td>
                  <td className="hidden px-5 py-3 text-slate-600 sm:table-cell">{e.role}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                        active
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                          : "bg-slate-100 text-slate-500 ring-slate-400/30"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(e)}
                      disabled={busyId === e.id}
                      className="min-h-10 text-xs font-medium text-slate-500 hover:text-ink-900 disabled:opacity-40"
                    >
                      {busyId === e.id
                        ? "Saving…"
                        : active
                        ? "Mark as left"
                        : "Mark as active"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  No employees match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
