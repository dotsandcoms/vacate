import { createClient } from "@supabase/supabase-js";
import { Employee, LeaveRequest, LeaveBalance } from "./types";
import { employees as mockEmployees, leaveRequests as mockRequests } from "./mock-data";
import { getKissflowData, usingKissflow } from "./kissflow";
import { exportedRequestIds } from "./exportlog";
import { computeBalancesBcea } from "./balances";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const usingSupabase = Boolean(supabaseUrl && supabaseKey);

// Supabase holds the historical register plus anything the Kissflow webhook
// has already written. The live Kissflow poll is merged on top of it — not
// used as a replacement — so brand-new TEST-process activity shows up
// immediately even before the webhook (or a tunnel to reach it locally)
// exists. Overlap between the two is de-duplicated by Kissflow request ID.
export { usingKissflow };
export const activeSource: "both" | "supabase" | "kissflow" | "mock" =
  usingSupabase && usingKissflow
    ? "both"
    : usingSupabase
    ? "supabase"
    : usingKissflow
    ? "kissflow"
    : "mock";
export const usingMockData = activeSource === "mock";

export function getSupabase() {
  if (!usingSupabase) return null;
  // Next.js's App Router patches the global fetch() to cache GET requests
  // to disk by default (survives dev-server restarts). supabase-js issues
  // plain GETs under the hood, so without this override a single stale
  // response (e.g. from before the schema/policies existed) would get
  // stuck in `.next/cache/fetch-cache` and never update again.
  return createClient(supabaseUrl!, supabaseKey!, {
    global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) },
  });
}

async function getSupabaseEmployees(): Promise<Employee[]> {
  const sb = getSupabase()!;
  const { data, error } = await sb.from("employees").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    employeeNo: r.employee_no,
    name: r.name,
    department: r.department,
    role: r.role,
    annualEntitlement: r.annual_entitlement,
    sickEntitlement: r.sick_entitlement,
  }));
}

async function getSupabaseLeaveRequests(): Promise<LeaveRequest[]> {
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("leave_requests")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    kissflowId: r.kissflow_id,
    employeeId: r.employee_id,
    type: r.type,
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    status: r.status,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    notes: r.notes,
    exportedAt: r.exported_at,
  }));
}

export async function getEmployees(): Promise<Employee[]> {
  if (activeSource === "mock") return mockEmployees;
  if (activeSource === "supabase") return getSupabaseEmployees();
  if (activeSource === "kissflow") return (await getKissflowData()).employees;

  // "both": Supabase is the base list — it carries the real entitlement
  // data and the IDs everything else in the app is keyed on. Any Kissflow
  // employee not already known by employee number gets appended as-is.
  const [sbEmployees, kf] = await Promise.all([
    getSupabaseEmployees(),
    getKissflowData(),
  ]);
  const knownEmployeeNos = new Set(sbEmployees.map((e) => e.employeeNo));
  const extra = kf.employees.filter((e) => !knownEmployeeNos.has(e.employeeNo));
  return [...sbEmployees, ...extra];
}

/** Overlay the export audit log: anything in a batch is locked as Exported. */
async function applyExportLog(requests: LeaveRequest[]): Promise<LeaveRequest[]> {
  const exported = await exportedRequestIds();
  if (exported.size === 0) return requests;
  return requests.map((r) => {
    const batch = exported.get(r.id);
    return batch
      ? { ...r, status: "Exported" as const, exportedAt: batch.exportedAt }
      : r;
  });
}

export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  if (activeSource === "mock") return applyExportLog(mockRequests);
  if (activeSource === "supabase") {
    return applyExportLog(await getSupabaseLeaveRequests());
  }
  if (activeSource === "kissflow") {
    const { requests } = await getKissflowData();
    return applyExportLog(requests);
  }

  // "both": Supabase requests are authoritative. Any live Kissflow request
  // not yet reflected in Supabase (by Kissflow request ID) is merged in on
  // top, with its employeeId remapped to match the Supabase employee record
  // for the same employee number — so it joins correctly everywhere the app
  // looks up employees by ID.
  const [sbEmployees, sbRequests, kf] = await Promise.all([
    getSupabaseEmployees(),
    getSupabaseLeaveRequests(),
    getKissflowData(),
  ]);
  const idByEmployeeNo = new Map(sbEmployees.map((e) => [e.employeeNo, e.id]));
  const kfEmployeeById = new Map(kf.employees.map((e) => [e.id, e]));
  const knownKissflowIds = new Set(
    sbRequests.map((r) => r.kissflowId).filter(Boolean)
  );
  const extra = kf.requests
    .filter((r) => !knownKissflowIds.has(r.kissflowId))
    .map((r) => {
      const kfEmp = kfEmployeeById.get(r.employeeId);
      const resolvedId = kfEmp ? idByEmployeeNo.get(kfEmp.employeeNo) : undefined;
      return resolvedId ? { ...r, employeeId: resolvedId } : r;
    });
  return applyExportLog([...sbRequests, ...extra]);
}

export function computeBalances(
  employees: Employee[],
  requests: LeaveRequest[]
): LeaveBalance[] {
  return computeBalancesBcea(employees, requests);
}
