import RegisterTable from "@/components/RegisterTable";
import { getKissflowRegister } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { employees, requests, source } = await getKissflowRegister();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Leave Register</h1>
        <p className="mt-1 text-sm text-slate-500">
          {source === "kissflow"
            ? "Live from Kissflow — every leave request on the process"
            : "Kissflow not connected — showing fallback data"}
        </p>
      </header>
      <RegisterTable employees={employees} requests={requests} />
    </div>
  );
}
