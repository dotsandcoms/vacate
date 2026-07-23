import RegisterTable from "@/components/RegisterTable";
import { getEmployees, getLeaveRequests } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [employees, requests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Leave Register</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every approved request synced from Kissflow
        </p>
      </header>
      <RegisterTable employees={employees} requests={requests} />
    </div>
  );
}
