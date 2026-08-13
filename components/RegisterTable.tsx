"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Info, Search } from "lucide-react";
import { Employee, LeaveRequest } from "@/lib/types";
import { statusStyles } from "@/lib/utils";
import { humanDate, humanRange } from "@/lib/holidays";
import Avatar from "./Avatar";

function RejectionInfo({ request }: { request: LeaveRequest }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const toggle = () => {
    if (pos) return setPos(null);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 264;
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
    });
  };

  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null);
    };
    const dismiss = () => setPos(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [pos]);

  return (
    <span className="inline-flex" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Show rejection reason"
        className="ml-1 text-red-400 hover:text-red-600"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {pos && (
        <span
          className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-panel-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <span className="block text-xs font-semibold text-red-700 mb-1">
            Rejected{request.rejectedBy ? ` by ${request.rejectedBy}` : ""}
            {request.rejectedAt
              ? ` · ${humanDate(request.rejectedAt.slice(0, 10))}`
              : ""}
          </span>
          <span className="block text-sm text-slate-700 whitespace-pre-wrap">
            {request.rejectionReason ?? "No reason was recorded in Kissflow."}
          </span>
        </span>
      )}
    </span>
  );
}

export default function RegisterTable({
  employees,
  requests,
}: {
  employees: Employee[];
  requests: LeaveRequest[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [dept, setDept] = useState("All");

  const empById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees]
  );
  const departments = useMemo(() => {
    const values = Array.from(
      new Set(
        employees
          .map((e) => e.department)
          .filter((d) => d && d !== "—")
      )
    ).sort();
    return values.length ? ["All", ...values] : [];
  }, [employees]);
  const types = useMemo(
    () => ["All", ...Array.from(new Set(requests.map((r) => r.type))).sort()],
    [requests]
  );

  const rows = useMemo(() => {
    return requests
      .filter((r) => {
        const emp = empById[r.employeeId];
        if (!emp) return false;
        if (status !== "All" && r.status !== status) return false;
        if (type !== "All" && r.type !== type) return false;
        if (dept !== "All" && emp.department !== dept) return false;
        if (q && !`${emp.name} ${emp.employeeNo} ${r.kissflowId}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      })
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [requests, empById, q, status, type, dept]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, emp no, KF ref…"
            className="input-base w-full py-2 pl-9 pr-3 sm:w-64"
          />
        </div>
        <select className="input-base py-2 pl-3 pr-8 sm:w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["All", "Awaiting Approval", "Approved", "Exported", "Rejected", "Cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input-base py-2 pl-3 pr-8 sm:w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {departments.length > 0 && (
          <select className="input-base py-2 pl-3 pr-8 sm:w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        )}
        <span className="w-full text-xs text-slate-400 sm:ml-auto sm:w-auto">{rows.length} records</span>
      </div>

      <div className="panel max-h-[70vh] overflow-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="text-left eyebrow">
              <th className="sticky top-0 z-10 bg-white/80 px-3 py-3 backdrop-blur-md sm:px-5">Employee</th>
              <th className="sticky top-0 z-10 hidden bg-white/80 px-5 py-3 backdrop-blur-md sm:table-cell">Type</th>
              <th className="sticky top-0 z-10 bg-white/80 px-3 py-3 backdrop-blur-md sm:px-5">Dates</th>
              <th className="sticky top-0 z-10 hidden bg-white/80 px-5 py-3 text-right backdrop-blur-md md:table-cell">Days</th>
              <th className="sticky top-0 z-10 hidden bg-white/80 px-5 py-3 backdrop-blur-md lg:table-cell">Kissflow ref</th>
              <th className="sticky top-0 z-10 hidden bg-white/80 px-5 py-3 backdrop-blur-md lg:table-cell">Actioned by</th>
              <th className="sticky top-0 z-10 bg-white/80 px-3 py-3 backdrop-blur-md sm:px-5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => {
              const emp = empById[r.employeeId];
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.name} />
                      <div>
                        <Link
                          href={`/employee/${emp.id}`}
                          className="font-medium hover:text-brand-600 hover:underline"
                        >
                          {emp.name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {emp.employeeNo} · {emp.department}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">{r.type}</td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                    {humanRange(r.startDate, r.endDate)}
                  </td>
                  <td className="hidden px-5 py-3 text-right font-medium md:table-cell">{r.days}</td>
                  <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">{r.kissflowId}</td>
                  <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">
                    {r.status === "Rejected" && r.rejectedBy ? (
                      <span className="text-red-600">{r.rejectedBy}</span>
                    ) : (
                      r.approvedBy
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    <span className="inline-flex items-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusStyles[r.status]}`}
                      >
                        {r.status}
                      </span>
                      {r.status === "Rejected" && <RejectionInfo request={r} />}
                    </span>
                    {r.status === "Awaiting Approval" &&
                      (r.currentStep ||
                        r.currentAssignee ||
                        typeof r.approvalProgress === "number") && (
                        <span className="block text-[11px] text-slate-400 mt-1">
                          {r.currentStep ?? "In approval"}
                          {r.currentAssignee ? ` · with ${r.currentAssignee}` : ""}
                          {typeof r.approvalProgress === "number"
                            ? ` · ${r.approvalProgress}%`
                            : ""}
                        </span>
                      )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  No leave records match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
