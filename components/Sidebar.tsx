"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LogoMark from "./LogoMark";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/register", label: "Leave Register", icon: ListChecks },
  { href: "/calendar", label: "Team Calendar", icon: CalendarDays },
  { href: "/exports", label: "Payroll Exports", icon: FileDown },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[15.5rem] shrink-0 flex-col p-3">
      <div className="flex h-full flex-col rounded-3xl border border-white/60 bg-white/70 p-3 shadow-panel backdrop-blur-md">
        <div className="flex items-center gap-3 px-2 pb-5 pt-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-900 text-brand-500 shadow-sm">
            <LogoMark className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold leading-tight text-ink-900">
              Vacate
            </div>
            <div className="truncate text-[11px] font-medium text-slate-500">
              Urban Task Force
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-ink-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-white/80 hover:text-ink-900"
                )}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 rounded-2xl border border-white/70 bg-white/55 px-3 py-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live from Kissflow
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Leave register · payroll bridge
          </p>
        </div>
      </div>
    </aside>
  );
}
