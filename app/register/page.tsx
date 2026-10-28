import RegisterTable from "@/components/RegisterTable";
import { getKissflowRegister } from "@/lib/data";
import { reportingWindowLabel } from "@/lib/reporting";
import { activeEmployees } from "@/lib/utils";
import { requireUser, scopeRequests } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await requireUser();
  const { employees: allEmployees, requests: allRequests, source, unresolved } =
    await getKissflowRegister();
  const scoped = scopeRequests(user, activeEmployees(allEmployees), allRequests);
  const employees = scoped.employees;
  const requests = scoped.requests;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Leave Register</h1>
        <p className="mt-1 text-sm text-slate-500">
          {source === "kissflow"
            ? `Supabase staff master · live Kissflow requests · ${reportingWindowLabel()}`
            : "Kissflow is not connected — nothing to show here"}
        </p>
      </header>
      {unresolved.length > 0 && (user.role === "admin" || user.role === "cfo") && (
        <section className="panel panel-pad border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-900">Leave records needing an employee match</h2>
          <p className="mt-1 text-sm text-amber-800">These records are excluded from balances and payroll until their owner is confirmed.</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {unresolved.map((r) => <li key={`${r.processId}:${r.requestId}`}>{r.name} · {r.startDate} · {r.requestId}</li>)}
          </ul>
        </section>
      )}
      {source === "kissflow" ? (
        <RegisterTable employees={employees.map(({ dailyCostR, ...employee }) => employee)} requests={requests} />
      ) : (
        <div className="panel panel-pad text-sm text-slate-500">
          Set the Kissflow env vars to load the leave register.
        </div>
      )}
    </div>
  );
}
