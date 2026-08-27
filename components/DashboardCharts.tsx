"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LeaveRequest, LeaveType } from "@/lib/types";
import { typeColors } from "@/lib/utils";
import { config } from "@/lib/config";
import { reportingWindowLabel } from "@/lib/reporting";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LEAVE_TYPES: LeaveType[] = [
  "Annual",
  "Sick",
  "Family Responsibility",
];

function MonthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/60 bg-white/80 px-3 py-2 text-xs shadow-panel-lg backdrop-blur-md">
      <div className="font-medium text-ink-900">{label}</div>
      <div className="mt-0.5 text-slate-500">
        {payload[0].value} day{payload[0].value === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function TypeTooltip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-white/60 bg-white/90 px-3 py-2 text-xs shadow-panel-lg backdrop-blur-md">
      <div className="font-medium text-ink-900">{item.name}</div>
      <div className="mt-0.5 text-slate-500">
        {value}{" "}
        {metric === "days"
          ? `day${value === 1 ? "" : "s"}`
          : `request${value === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}

function monthsThrough(fromIso: string, toIso: string) {
  const out: { key: string; label: string }[] = [];
  let [y, m] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push({
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: `${MONTHS[m - 1]} ${String(y).slice(2)}`,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export default function DashboardCharts({
  requests,
  throughDate,
}: {
  requests: LeaveRequest[];
  throughDate: string;
}) {
  const [metric, setMetric] = useState<"days" | "requests">("days");
  const [selectedType, setSelectedType] = useState<LeaveType | null>(null);
  const active = requests.filter(
    (r) =>
      r.status !== "Cancelled" &&
      r.status !== "Rejected" &&
      r.startDate >= config.reportingFrom &&
      r.startDate <= throughDate
  );

  const byType = LEAVE_TYPES.map((name) => {
    const matching = active.filter((request) => request.type === name);
    return {
      name,
      days: matching.reduce((sum, request) => sum + request.days, 0),
      requests: matching.length,
    };
  });
  const typeTotal = byType.reduce((sum, item) => sum + item[metric], 0);
  const selected = selectedType
    ? byType.find((item) => item.name === selectedType)
    : null;

  const byMonth = monthsThrough(config.reportingFrom, throughDate).map((m) => ({
    month: m.label,
    days: active
      .filter((r) => r.startDate.startsWith(m.key))
      .reduce((s, r) => s + r.days, 0),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <section className="panel panel-pad lg:col-span-3">
        <h2 className="section-title mb-1">Leave days by month</h2>
        <p className="mb-3 text-xs text-slate-400">{reportingWindowLabel()}</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 10, right: 6, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                interval={1}
                tick={{ fill: "#94a3b8" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tick={{ fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} content={<MonthTooltip />} />
              <Bar dataKey="days" fill="#116152" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel panel-pad lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="section-title mb-1">Leave type mix</h2>
            <p className="text-xs text-slate-400">{reportingWindowLabel()}</p>
          </div>
          <div
            className="inline-flex rounded-lg bg-slate-100/80 p-0.5"
            aria-label="Chart measure"
          >
            {(["days", "requests"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={metric === option}
                onClick={() => setMetric(option)}
                className={`min-h-9 rounded-md px-2.5 text-xs font-medium capitalize transition-colors sm:min-h-0 sm:py-1.5 ${
                  metric === option
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        {typeTotal === 0 ? (
          <p className="text-sm text-slate-400 py-4">No leave recorded yet.</p>
        ) : (
          <>
            <div
              className="relative mx-auto h-44 max-w-xs"
              role="img"
              aria-label={`${typeTotal} leave ${metric} split across Annual, Sick and Family Responsibility leave`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={byType}
                    dataKey={metric}
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                    onClick={(item) =>
                      setSelectedType((current) =>
                        current === item.name ? null : (item.name as LeaveType)
                      )
                    }
                  >
                    {byType.map((item) => (
                      <Cell
                        key={item.name}
                        fill={typeColors[item.name]}
                        opacity={
                          selectedType && selectedType !== item.name ? 0.25 : 1
                        }
                        className="cursor-pointer transition-opacity"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<TypeTooltip metric={metric} />} />
                </PieChart>
              </ResponsiveContainer>
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                aria-live="polite"
              >
                <span className="font-display text-2xl font-medium tabular-nums text-ink-900">
                  {selected?.[metric] ?? typeTotal}
                </span>
                <span className="max-w-24 text-[11px] leading-tight text-slate-400">
                  {selected?.name ?? `total ${metric}`}
                </span>
              </div>
            </div>
            <ul className="space-y-1" aria-label="Leave type breakdown">
              {byType.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    aria-pressed={selectedType === t.name}
                    onClick={() =>
                      setSelectedType((current) =>
                        current === t.name ? null : t.name
                      )
                    }
                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-2 text-sm transition-colors sm:min-h-0 sm:py-1.5 ${
                      selectedType === t.name
                        ? "bg-slate-100/80 text-ink-900"
                        : "text-slate-600 hover:bg-slate-50/80"
                    }`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: typeColors[t.name] }}
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span className="shrink-0 font-display font-medium tabular-nums text-ink-900">
                      {t[metric]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
