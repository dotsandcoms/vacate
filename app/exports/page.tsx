import ExportPanel from "@/components/ExportPanel";
import { getKissflowRegister } from "@/lib/data";
import { reportingWindowLabel } from "@/lib/reporting";
import { activeEmployees } from "@/lib/utils";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  await requireUser(["admin", "cfo"]);
  const { employees: allEmployees, requests: allRequests, source } =
    await getKissflowRegister();
  const employees = activeEmployees(allEmployees);
  const employeeIds = new Set(employees.map((e) => e.id));
  const requests = allRequests.filter((r) => employeeIds.has(r.employeeId));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Exports</h1>
        <p className="mt-1 text-sm text-slate-500">
          {source === "kissflow"
            ? `Kissflow only · ${reportingWindowLabel()} · approved items ready for payroll`
            : "Kissflow is not connected — nothing to export"}
        </p>
      </header>
      {source === "kissflow" ? (
        <ExportPanel employees={employees} requests={requests} />
      ) : (
        <div className="panel panel-pad text-sm text-slate-500">
          Set the Kissflow env vars to load approved leave for export.
        </div>
      )}
    </div>
  );
}
