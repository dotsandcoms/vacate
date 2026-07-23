import { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "bg-brand-50 text-brand-600",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className="panel panel-pad">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="mt-1.5 stat-value">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}
