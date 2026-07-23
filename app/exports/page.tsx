import ExportPanel from "@/components/ExportPanel";
import { getEmployees, getLeaveRequests } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const [employees, requests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Exports</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate the payroll import batch for approved leave — the format will be
          matched to your payroll system
        </p>
      </header>
      <ExportPanel employees={employees} requests={requests} />
    </div>
  );
}
