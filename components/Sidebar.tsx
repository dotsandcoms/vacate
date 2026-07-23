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
    <aside className="w-60 shrink-0 bg-ink-900 text-slate-300 flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-7 pb-6">
        <LogoMark className="h-8 w-8 text-brand-500" />
        <div>
          <div className="font-display text-lg font-semibold leading-tight text-white">
            Vacate
          </div>
          <div className="text-[11px] font-medium tracking-wide text-slate-500 -mt-0.5">
            <span className="text-slate-400">URBAN </span>
            <span className="text-brand-500">TASK FORCE</span>
          </div>
        </div>
      </div>

      <nav className="px-3 space-y-0.5 flex-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-500" />
              )}
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
          </span>
          Synced from Kissflow
        </div>
      </div>
    </aside>
  );
}
