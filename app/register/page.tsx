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
            ? "Kissflow only — live process items, no Supabase or Excel history"
            : "Kissflow is not connected — nothing to show here"}
        </p>
      </header>
      {source === "kissflow" ? (
        <RegisterTable employees={employees} requests={requests} />
      ) : (
        <div className="panel panel-pad text-sm text-slate-500">
          Set the Kissflow env vars to load the leave register.
        </div>
      )}
    </div>
  );
}
