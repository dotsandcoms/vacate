"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  CalendarDays,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { reportingFromLabel } from "@/lib/reporting";
import LogoMark from "./LogoMark";

const nav = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", short: "Staff", icon: Users },
  { href: "/register", label: "Leave Register", short: "Register", icon: ListChecks },
  { href: "/calendar", label: "Team Calendar", short: "Calendar", icon: CalendarDays },
  { href: "/exports", label: "Payroll Exports", short: "Payroll", icon: FileDown },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 flex-col p-3 lg:flex">
        <div className="flex h-full flex-col rounded-3xl border border-white/60 bg-white/70 p-3 shadow-panel backdrop-blur-md">
          <div className="flex items-center gap-3 px-2 pb-5 pt-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-900 text-brand-500 shadow-sm">
              <LogoMark className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold leading-tight text-ink-900">
                UTF-Leave
              </div>
              <div className="truncate text-[11px] font-medium text-slate-500">
                Urban Task Force
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-0.5">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
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
              Showing data from {reportingFromLabel()}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-brand-500">
              <LogoMark className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-semibold leading-tight text-ink-900">
                Vacate
              </p>
              <p className="truncate text-[11px] text-slate-500">
                From {reportingFromLabel()}
              </p>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
          aria-label="Primary"
        >
          <ul className="grid grid-cols-5">
            {nav.map(({ href, short, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium",
                      active ? "text-ink-900" : "text-slate-400"
                    )}
                  >
                    <Icon
                      className="h-5 w-5"
                      strokeWidth={active ? 2.2 : 1.75}
                    />
                    {short}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
