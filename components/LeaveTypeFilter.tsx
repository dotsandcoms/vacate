"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tags } from "lucide-react";
import { LeaveType } from "@/lib/types";

export default function LeaveTypeFilter({
  leaveTypes,
  selected,
}: {
  leaveTypes: LeaveType[];
  selected: LeaveType | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setLeaveType = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete("leaveType");
    else next.set("leaveType", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <label className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-panel backdrop-blur-md sm:min-h-0 sm:w-auto sm:py-1.5">
      <Tags className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="sr-only">Filter by leave type</span>
      <select
        value={selected ?? ""}
        onChange={(event) => setLeaveType(event.target.value)}
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-base font-medium text-ink-900 outline-none sm:max-w-[14rem] sm:text-sm"
      >
        <option value="">All leave types</option>
        {leaveTypes.map((leaveType) => (
          <option key={leaveType} value={leaveType}>
            {leaveType}
          </option>
        ))}
      </select>
    </label>
  );
}
