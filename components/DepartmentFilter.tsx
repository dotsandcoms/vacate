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
    <label className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-panel backdrop-blur-md sm:min-h-0 sm:w-auto sm:py-1.5">
      <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="sr-only">Filter by department</span>
      <select
        value={selected ?? ""}
        onChange={(e) => setDepartment(e.target.value)}
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-base font-medium text-ink-900 outline-none sm:max-w-[14rem] sm:text-sm"
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
