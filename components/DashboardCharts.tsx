"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LeaveRequest } from "@/lib/types";
import { typeColors } from "@/lib/utils";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-panel-lg">
      <div className="font-medium text-ink-900">{label}</div>
      <div className="mt-0.5 text-slate-500">
        {payload[0].value} day{payload[0].value === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export default function DashboardCharts({
  requests,
}: {
  requests: LeaveRequest[];
}) {
  const active = requests.filter(
    (r) => r.status !== "Cancelled" && r.status !== "Rejected"
  );

  const byType = Object.entries(
    active.reduce<Record<string, number>>((acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + r.days;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const typeTotal = byType.reduce((s, t) => s + t.value, 0) || 1;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byMonth = months.map((m, i) => ({
    month: m,
    days: active
      .filter((r) => new Date(r.startDate + "T00:00:00").getMonth() === i)
      .reduce((s, r) => s + r.days, 0),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <section className="panel panel-pad lg:col-span-3">
        <h2 className="section-title mb-3">Leave days by month</h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 10, right: 6, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tick={{ fill: "#94a3b8" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tick={{ fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip />} />
              <Bar dataKey="days" fill="#116152" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel panel-pad lg:col-span-2">
        <h2 className="section-title mb-4">Days by leave type</h2>
        {byType.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No leave recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {byType.map((t) => (
              <li key={t.name}>
                <div className="flex items-baseline justify-between text-sm mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: typeColors[t.name] ?? "#94a3b8" }}
                    />
                    {t.name}
                  </span>
                  <span className="font-display font-medium tabular-nums text-ink-900">
                    {t.value}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(3, (t.value / typeTotal) * 100)}%`,
                      backgroundColor: typeColors[t.name] ?? "#94a3b8",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
