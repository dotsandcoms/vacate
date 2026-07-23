import ExportPanel from "@/components/ExportPanel";
import { getKissflowRegister } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const { employees, requests, source } = await getKissflowRegister();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Exports</h1>
        <p className="mt-1 text-sm text-slate-500">
          {source === "kissflow"
            ? "Kissflow only — approved process items ready for payroll"
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
