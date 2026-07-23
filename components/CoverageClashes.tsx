import Link from "next/link";
import { AlertTriangle, CalendarDays } from "lucide-react";
import Avatar from "@/components/Avatar";
import { format, parseISO } from "date-fns";
import { humanDate } from "@/lib/holidays";

export type ClashRow = {
  date: string;
  people: { id: string; name: string }[];
};

function severity(count: number): {
  badge: string;
  bar: string;
  label: string;
} {
  if (count >= 4) {
    return {
      badge: "bg-rose-100 text-rose-800 ring-rose-600/20",
      bar: "bg-rose-500",
      label: "High",
    };
  }
  if (count >= 3) {
    return {
      badge: "bg-orange-100 text-orange-800 ring-orange-600/20",
      bar: "bg-orange-400",
      label: "Elevated",
    };
  }
  return {
    badge: "bg-amber-100 text-amber-800 ring-amber-600/20",
    bar: "bg-amber-400",
    label: "Watch",
  };
}

/**
 * Visual coverage-clash list — date chips, severity, avatar stacks.
 */
export default function CoverageClashes({
  clashes,
  threshold,
}: {
  clashes: ClashRow[];
  threshold: number;
}) {
  const visible = clashes.slice(0, 8);
  const maxCount = Math.max(1, ...visible.map((c) => c.people.length));

  if (clashes.length === 0) {
    return (
      <section className="panel panel-pad">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Coverage clashes</h2>
            <p className="mt-1 text-xs text-slate-400">
              Working days in the next 60 with {threshold}+ staff out at once
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-4 py-8 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            No clashes ahead — coverage looks clear.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel-pad">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Coverage clashes
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Working days in the next 60 with {threshold}+ staff out at once
          </p>
        </div>
        <Link
          href="/calendar"
          className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Open calendar
        </Link>
      </div>

      <ul className="space-y-2">
        {visible.map((c) => {
          const count = c.people.length;
          const sev = severity(count);
          const date = parseISO(c.date);
          const shown = c.people.slice(0, 5);
          const overflow = count - shown.length;

          return (
            <li
              key={c.date}
              className="group flex flex-col gap-3 rounded-xl border border-white/50 bg-white/45 px-3 py-3 transition hover:bg-white/70 hover:shadow-panel sm:flex-row sm:items-center sm:gap-4"
            >
              {/* Date chip */}
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  {format(date, "EEE")}
                </span>
                <span className="font-display text-xl font-semibold leading-none">
                  {format(date, "d")}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink-900">
                    {humanDate(c.date)}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${sev.badge}`}
                  >
                    {count} out · {sev.label}
                  </span>
                </div>

                {/* Intensity bar */}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className={`h-full rounded-full ${sev.bar}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>

                {/* Avatar stack + names */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex -space-x-2">
                    {shown.map((p) => (
                      <Link
                        key={`${c.date}-${p.id}`}
                        href={`/employee/${p.id}`}
                        title={p.name}
                        className="rounded-full ring-2 ring-white transition hover:z-10 hover:scale-110"
                      >
                        <Avatar name={p.name} />
                      </Link>
                    ))}
                    {overflow > 0 && (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white">
                        +{overflow}
                      </span>
                    )}
                  </div>
                  <p className="min-w-0 truncate text-xs text-slate-500">
                    {c.people.map((p) => p.name).join(" · ")}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {clashes.length > visible.length ? (
        <p className="mt-3 text-xs text-slate-400">
          +{clashes.length - visible.length} more days in the next 60 — see the
          team calendar for the full picture.
        </p>
      ) : null}
    </section>
  );
}
