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
            ? "Approved Kissflow leave ready for payroll — already processed upstream"
            : "Kissflow not connected — showing fallback data"}
        </p>
      </header>
      <ExportPanel employees={employees} requests={requests} />
    </div>
  );
}
