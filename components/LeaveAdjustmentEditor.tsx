"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { LEAVE_TYPES } from "@/lib/leave-adjustments";
import type { LeaveRequest } from "@/lib/types";

export default function LeaveAdjustmentEditor({ request }: { request: LeaveRequest }) {
  const router = useRouter();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const busy = saving || refreshing;
  const prefix = `adjust-${request.id}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/leave-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: request.employeeId,
          requestId: request.id,
          type: form.get("type"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          days: Number(form.get("days")),
          reason: form.get("reason"),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save the correction.");
      setSaved(true);
      close();
      startTransition(() => router.refresh());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (disclosure.current) {
      disclosure.current.open = false;
      disclosure.current.querySelector("summary")?.focus();
    }
  }

  return (
    <div className="mt-3">
      <details ref={disclosure} onToggle={() => { if (disclosure.current?.open) setSaved(false); }}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-xs font-medium text-brand-700 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit leave
          <span className="sr-only"> for {request.startDate} to {request.endDate}</span>
        </summary>
        <form
          key={`${request.type}:${request.startDate}:${request.endDate}:${request.days}:${request.adjustment?.adjustedAt ?? ""}`}
          onSubmit={save}
          className="mt-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
          aria-label={`Correct leave from ${request.startDate}`}
          aria-busy={busy}
        >
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${prefix}-type`} className="text-xs font-medium text-ink-900">Leave type</label>
              <select id={`${prefix}-type`} name="type" defaultValue={request.type} className="input-base mt-1.5 px-3 py-2" required>
                {LEAVE_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${prefix}-start`} className="text-xs font-medium text-ink-900">Start date</label>
              <input id={`${prefix}-start`} name="startDate" type="date" defaultValue={request.startDate} className="input-base mt-1.5 px-3 py-2" required />
            </div>
            <div>
              <label htmlFor={`${prefix}-end`} className="text-xs font-medium text-ink-900">End date</label>
              <input id={`${prefix}-end`} name="endDate" type="date" defaultValue={request.endDate} className="input-base mt-1.5 px-3 py-2" required />
            </div>
            <div>
              <label htmlFor={`${prefix}-days`} className="text-xs font-medium text-ink-900">Leave days</label>
              <input id={`${prefix}-days`} name="days" type="number" min="0.01" max="366" step="0.01" defaultValue={request.days} className="input-base mt-1.5 px-3 py-2" required />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor={`${prefix}-reason`} className="text-xs font-medium text-ink-900">Reason for correction</label>
              <textarea id={`${prefix}-reason`} name="reason" rows={2} maxLength={1000} className="input-base mt-1.5 px-3 py-2" required />
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">Balances update automatically, including corrections to leave covered by an opening balance.</p>
          {request.status === "Exported" && <p className="text-xs text-slate-500">The original payroll export stays on file. This correction updates the leave record.</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save correction"}</button>
            <button type="button" className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100" disabled={busy} onClick={(event) => { setError(null); event.currentTarget.form?.reset(); close(); }}>Cancel</button>
          </div>
        </form>
      </details>
      {saved && <p role="status" className="mt-1 text-xs text-emerald-700">Correction saved.</p>}
    </div>
  );
}
