"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

export default function BalanceExportButton() {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const department = searchParams.get("department")?.trim();
      const leaveType = searchParams.get("leaveType")?.trim();
      if (department) params.set("department", department);
      if (leaveType) params.set("leaveType", leaveType);
      const response = await fetch(`/api/balances/export${params.size ? `?${params}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to export leave balances.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const matched = /filename="([^"]+)"/i.exec(disposition);
      const filename = matched?.[1] ?? "leave-balances.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to export leave balances.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 text-sm font-medium text-ink-900 shadow-sm transition-[background-color,transform] hover:bg-white active:scale-[0.98] disabled:opacity-60"
      >
        <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {busy ? "Preparing…" : "Export balances"}
      </button>
      {error && (
        <p role="alert" className="absolute left-0 top-full z-10 mt-1 max-w-56 rounded-lg bg-white px-2 py-1 text-xs text-red-700 shadow-sm ring-1 ring-red-100 sm:left-auto sm:right-0">
          {error}
        </p>
      )}
    </div>
  );
}
