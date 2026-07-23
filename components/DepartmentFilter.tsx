"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";

/**
 * Department scope for the dashboard — updates `?department=` in the URL.
 */
export default function DepartmentFilter({
  departments,
  selected,
}: {
  departments: string[];
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setDepartment = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete("department");
    else next.set("department", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-1.5 text-sm shadow-panel backdrop-blur-md">
      <Building2 className="h-4 w-4 text-slate-400" />
      <span className="sr-only">Filter by department</span>
      <select
        value={selected ?? ""}
        onChange={(e) => setDepartment(e.target.value)}
        className="max-w-[14rem] cursor-pointer bg-transparent text-sm font-medium text-ink-900 outline-none"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </label>
  );
}
