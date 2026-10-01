import ExportPanel from "@/components/ExportPanel";
import { getKissflowRegister } from "@/lib/data";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  await requireUser(["admin", "cfo"]);
  const { employees: allEmployees, requests: allRequests, source } =
    await getKissflowRegister({ allDates: true });
  const employees = allEmployees;
  const requests = allRequests;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Exports</h1>
        <p className="mt-1 text-sm text-slate-500">
          {source === "kissflow"
            ? "Select approved leave and download your payroll import file."
            : "Connect Kissflow to load approved leave."}
        </p>
      </header>
      <ExportPanel employees={employees} requests={requests} />
      {source !== "kissflow" && (
        <div className="panel panel-pad text-sm text-slate-500">
          Set the Kissflow env vars to load approved leave for export.
        </div>
      )}
    </div>
  );
}
