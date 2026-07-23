"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Lock, Search } from "lucide-react";
import { Employee, LeaveRequest } from "@/lib/types";
import { humanRange } from "@/lib/holidays";
import Avatar from "./Avatar";

interface Batch {
  id: string;
  exportedAt: string;
  exportedBy: string;
  requestIds: string[];
  totalDays: number;
  employeeCount: number;
}

export default function ExportPanel({
  employees,
  requests,
}: {
  employees: Employee[];
  requests: LeaveRequest[];
}) {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const empById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees]
  );

  // Kissflow Completed → Approved; Vacate export log then locks as Exported.
  const pending = useMemo(
    () => requests.filter((r) => r.status === "Approved"),
    [requests]
  );

  const visiblePending = useMemo(() => {
    if (!q) return pending;
    const needle = q.toLowerCase();
    return pending.filter((r) => {
      const e = empById[r.employeeId];
      return `${e?.name} ${e?.employeeNo} ${r.kissflowId}`
        .toLowerCase()
        .includes(needle);
    });
  }, [pending, empById, q]);

  const loadBatches = () =>
    fetch("/api/exports")
      .then((r) => r.json())
      .then(setBatches)
      .catch(() => {});

  useEffect(() => {
    loadBatches();
  }, []);

  const downloadCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const header = [
        "EmployeeNumber",
        "EmployeeName",
        "LeaveType",
        "StartDate",
        "EndDate",
        "Days",
        "Reference",
        "ApprovedBy",
      ];
      const lines = pending.map((r) => {
        const e = empById[r.employeeId];
        return [
          e.employeeNo,
          e.name,
          r.type,
          r.startDate,
          r.endDate,
          String(r.days),
          r.kissflowId,
          r.approvedBy,
        ]
          .map((v) => `"${(v ?? "").replace(/"/g, '""')}"`)
          .join(",");
      });
      const csv = [header.join(","), ...lines].join("\n");

      // Record the batch first — if this fails, no file is produced and
      // nothing is marked exported.
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestIds: pending.map((r) => r.id),
          totalDays: pending.reduce((s, r) => s + r.days, 0),
          employeeCount: new Set(pending.map((r) => r.employeeId)).size,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }
      const batch: Batch = await res.json();

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batch.id.toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      await loadBatches();
      router.refresh(); // server re-renders with these requests locked
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const totalDays = pending.reduce((s, r) => s + r.days, 0);

  return (
    <div className="space-y-4">
      <div className="panel panel-pad flex flex-wrap items-center gap-4">
        <div className="rounded-xl bg-brand-50 p-3 text-brand-600">
          <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-48">
          <p className="section-title">Current batch</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {pending.length} approved request{pending.length === 1 ? "" : "s"} ·{" "}
            {totalDays} day{totalDays === 1 ? "" : "s"} · awaiting payroll sync
          </p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={pending.length === 0 || busy}
          className="btn-primary bg-brand-600 hover:bg-brand-700"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          {busy ? "Exporting…" : "Export batch (CSV)"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-600/20">
          {error}
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, emp no, KF ref…"
              className="input-base w-64 py-2 pl-9 pr-3"
            />
          </div>
          <span className="text-xs text-slate-400">
            {visiblePending.length} of {pending.length} shown · export always
            includes the full batch
          </span>
        </div>
      )}

      <div className="panel overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="text-left eyebrow">
              <th className="px-4 py-2.5">Emp no</th>
              <th className="px-4 py-2.5">Employee</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Dates</th>
              <th className="px-4 py-2.5 text-right">Days</th>
              <th className="px-4 py-2.5">Kissflow ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visiblePending.map((r) => {
              const e = empById[r.employeeId];
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-500">{e.employeeNo}</td>
                  <td className="px-4 py-2.5 font-medium">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.name} />
                      <Link
                        href={`/employee/${e.id}`}
                        className="hover:text-brand-600 hover:underline"
                      >
                        {e.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{r.type}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {humanRange(r.startDate, r.endDate)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{r.days}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.kissflowId}</td>
                </tr>
              );
            })}
            {pending.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  Nothing waiting to sync. Approved requests land here
                  automatically — check back before the next payroll run.
                </td>
              </tr>
            )}
            {pending.length > 0 && visiblePending.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No pending requests match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="section-title mb-2 mt-6 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          Export history
        </h2>
        <div className="panel overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left eyebrow">
                <th className="px-4 py-2.5">Batch</th>
                <th className="px-4 py-2.5">Exported</th>
                <th className="px-4 py-2.5 text-right">Requests</th>
                <th className="px-4 py-2.5 text-right">Days</th>
                <th className="px-4 py-2.5 text-right">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium">{b.id}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(b.exportedAt).toLocaleString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right">{b.requestIds.length}</td>
                  <td className="px-4 py-2.5 text-right">{b.totalDays}</td>
                  <td className="px-4 py-2.5 text-right">{b.employeeCount}</td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                    No batches exported yet. Every export is logged here and its
                    requests are locked against double-payment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
