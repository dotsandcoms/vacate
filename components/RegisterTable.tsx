"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Info, Search, X } from "lucide-react";
import { Employee, LeaveRequest } from "@/lib/types";
import { statusStyles } from "@/lib/utils";
import { humanDate, humanRange } from "@/lib/holidays";
import Avatar from "./Avatar";

function RejectionInfo({ request }: { request: LeaveRequest }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    const handleClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", handleClose);
    dialog.showModal();

    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const close = () => dialogRef.current?.close();

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show rejection reason"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="ml-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            onClick={(event) => {
              if (event.target === dialogRef.current) close();
            }}
            className="m-auto max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/70 bg-white p-0 text-left shadow-panel-lg backdrop:bg-slate-950/30 backdrop:backdrop-blur-[2px]"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id={titleId} className="text-base font-semibold text-red-700">
                    Rejected{request.rejectedBy ? ` by ${request.rejectedBy}` : ""}
                  </h2>
                  {request.rejectedAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      {humanDate(request.rejectedAt.slice(0, 10))}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  autoFocus
                  aria-label="Close rejection details"
                  className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {request.rejectionReason ?? "No reason was recorded in Kissflow."}
              </p>
            </div>
          </dialog>,
          document.body
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
