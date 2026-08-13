import { clsx, type ClassValue } from "clsx";
import { Employee } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function isActiveEmployee(emp: Employee): boolean {
  return emp.active !== false;
}

export function activeEmployees(employees: Employee[]): Employee[] {
  return employees.filter(isActiveEmployee);
}

// Green = approved, yellow = pending/awaiting approval, red = rejected.
export const statusStyles: Record<string, string> = {
  "Awaiting Approval": "bg-yellow-50 text-yellow-800 ring-yellow-600/30",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Pending Sync": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Exported: "bg-emerald-100 text-emerald-800 ring-emerald-700/20",
  Rejected: "bg-red-50 text-red-700 ring-red-600/20",
  Cancelled: "bg-slate-50 text-slate-400 ring-slate-400/20 line-through",
};

// One hue family + warm exceptions — deliberately not a rainbow.
export const typeColors: Record<string, string> = {
  Annual: "#116152",
  Sick: "#9a3412",
  "Family Responsibility": "#a16207",
  "Maternity/Paternity": "#334155",
  Study: "#0e7490",
  Unpaid: "#94a3b8",
};
