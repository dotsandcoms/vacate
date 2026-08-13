"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Employee } from "@/lib/types";
import Avatar from "./Avatar";

export default function EmployeeSearch({
  employees,
}: {
  employees: Employee[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return employees
      .filter((e) =>
        `${e.name} ${e.employeeNo} ${e.department}`
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 8);
  }, [q, employees]);

  const goTo = (id: string) => {
    setQ("");
    setOpen(false);
    router.push(`/employee/${id}`);
  };

  return (
    <div className="relative w-full sm:w-auto" ref={boxRef}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) goTo(matches[0].id);
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Find an employee…"
        className="input-base w-full py-2 pl-9 pr-3 sm:w-56"
      />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-white/60 bg-white/80 shadow-panel-lg backdrop-blur-md sm:left-auto sm:right-0 sm:w-72">
          {matches.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No matches.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onMouseDown={() => goTo(e.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Avatar name={e.name} />
                    <span>
                      <span className="block text-sm font-medium">{e.name}</span>
                      <span className="block text-xs text-slate-400">
                        {e.employeeNo} · {e.department}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
