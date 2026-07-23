"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, FileDown, ThumbsDown, ThumbsUp, UserPlus } from "lucide-react";

interface AppNotification {
  id: string;
  at: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
}

const icons: Record<string, React.ReactNode> = {
  new_request: <UserPlus className="h-4 w-4 text-yellow-600" />,
  approved: <ThumbsUp className="h-4 w-4 text-emerald-600" />,
  rejected: <ThumbsDown className="h-4 w-4 text-red-600" />,
  exported: <FileDown className="h-4 w-4 text-brand-600" />,
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export default function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setItems(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="section-title">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {items.slice(0, 30).map((n) => (
              <li
                key={n.id}
                className={`flex gap-3 px-4 py-3 ${n.read ? "" : "bg-brand-50/40"}`}
              >
                <span className="mt-0.5 shrink-0">
                  {icons[n.type] ?? <Bell className="h-4 w-4 text-slate-400" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug">
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {n.body}
                    </span>
                  )}
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    {timeAgo(n.at)}
                  </span>
                </span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                Nothing yet. New requests, approvals, rejections and payroll
                exports will show up here.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
