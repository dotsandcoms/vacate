import { createClient } from "@supabase/supabase-js";
import { Employee, LeaveRequest, LeaveBalance } from "./types";
import { employees as mockEmployees, leaveRequests as mockRequests } from "./mock-data";
import { getKissflowData, usingKissflow } from "./kissflow";
import { exportedRequestIds } from "./exportlog";
import { computeBalancesBcea } from "./balances";
import {
  mergeOpeningsOntoEmployees,
  nameMatchScore,
  normalizePersonName,
  readOpeningsFile,
} from "./openings";
import { applyEmployeeStatus } from "./employee-status";
import { filterReportingWindow } from "./reporting";

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

function mapEmployeeRow(r: any): Employee {
  return {
    id: r.id,
    employeeNo: r.employee_no,
    name: r.name,
    department: r.department,
    role: r.role,
    annualEntitlement: Number(r.annual_entitlement),
    sickEntitlement: Number(r.sick_entitlement),
    openingAnnualBalance:
      r.opening_annual_balance != null
        ? Number(r.opening_annual_balance)
        : null,
    openingSickBalance:
      r.opening_sick_balance != null ? Number(r.opening_sick_balance) : null,
    openingFamilyBalance:
      r.opening_family_balance != null
        ? Number(r.opening_family_balance)
        : null,
    openingBalanceAsOf: r.opening_balance_as_of ?? null,
    excelName: r.excel_name ?? null,
    active: r.active !== false,
  };
}

async function getSupabaseEmployees(): Promise<Employee[]> {
  const sb = getSupabase()!;
  const { data, error } = await sb.from("employees").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapEmployeeRow);
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

async function withExcelOpenings(employees: Employee[]): Promise<Employee[]> {
  const file = await readOpeningsFile();
  return applyEmployeeStatus(mergeOpeningsOntoEmployees(employees, file));
}

export async function getEmployees(): Promise<Employee[]> {
  if (activeSource === "mock") return withExcelOpenings(mockEmployees);
  if (activeSource === "supabase") {
    return getSupabaseEmployees();
  }
  if (activeSource === "kissflow") {
    return withExcelOpenings((await getKissflowData()).employees);
  }

  // "both": the Supabase roster is the employee master. Kissflow contributes
  // live leave requests only; people absent from the master are not appended.
  return getSupabaseEmployees();
}

function remapKissflowRequestsToMaster(
  requests: LeaveRequest[],
  kissflowEmployees: Employee[],
  masterEmployees: Employee[]
): LeaveRequest[] {
  const canonicalEmployeeNo = (value: string) => {
    const normalized = value.trim().toUpperCase();
    return /^\d+$/.test(normalized)
      ? normalized.replace(/^0+(?=\d)/, "")
      : normalized;
  };
  const idByEmployeeNo = new Map(
    masterEmployees
      .filter((employee) => employee.employeeNo.trim())
      .map((employee) => [canonicalEmployeeNo(employee.employeeNo), employee.id])
  );
  const idByName = new Map(
    masterEmployees.map((employee) => [
      normalizePersonName(employee.name),
      employee.id,
    ])
  );
  const kissflowEmployeeById = new Map(
    kissflowEmployees.map((employee) => [employee.id, employee])
  );
  const fuzzyIdByKissflowEmployeeId = new Map<string, string | undefined>();

  const fuzzyMasterId = (kissflowEmployee: Employee) => {
    if (fuzzyIdByKissflowEmployeeId.has(kissflowEmployee.id)) {
      return fuzzyIdByKissflowEmployeeId.get(kissflowEmployee.id);
    }
    const candidates = masterEmployees
      .map((employee) => ({
        id: employee.id,
        score: nameMatchScore(kissflowEmployee.name, employee.name),
      }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];
    const resolved =
      best &&
      best.score >= 0.75 &&
      best.score - (second?.score ?? 0) >= 0.15
        ? best.id
        : undefined;
    fuzzyIdByKissflowEmployeeId.set(kissflowEmployee.id, resolved);
    return resolved;
  };

  return requests.flatMap((request) => {
    const kissflowEmployee = kissflowEmployeeById.get(request.employeeId);
    if (!kissflowEmployee) return [];
    const resolvedId =
      (kissflowEmployee.employeeNo
        ? idByEmployeeNo.get(canonicalEmployeeNo(kissflowEmployee.employeeNo))
        : undefined) ??
      idByName.get(normalizePersonName(kissflowEmployee.name)) ??
      fuzzyMasterId(kissflowEmployee);
    return resolvedId ? [{ ...request, employeeId: resolvedId }] : [];
  });
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

export async function getLeaveRequests(opts?: {
  allDates?: boolean;
}): Promise<LeaveRequest[]> {
  let requests: LeaveRequest[];
  if (activeSource === "mock") {
    requests = await applyExportLog(mockRequests);
  } else if (activeSource === "supabase") {
    requests = await applyExportLog(await getSupabaseLeaveRequests());
  } else if (activeSource === "kissflow") {
    const { requests: kfRequests } = await getKissflowData();
    requests = await applyExportLog(kfRequests);
  } else {
    // "both": handled below
    requests = [];
  }

  if (activeSource === "mock" || activeSource === "supabase" || activeSource === "kissflow") {
    return opts?.allDates ? requests : filterReportingWindow(requests);
  }

  // "both": Supabase requests are authoritative. Any live Kissflow request
  // not yet reflected in Supabase (by Kissflow request ID) is merged in on
  // top, with its employeeId remapped to the Supabase master by employee
  // number or normalized name. Requests for people absent from the master are
  // intentionally excluded.
  const [sbEmployees, sbRequests, kf] = await Promise.all([
    getSupabaseEmployees(),
    getSupabaseLeaveRequests(),
    getKissflowData(),
  ]);
  const knownKissflowIds = new Set(
    sbRequests.map((r) => r.kissflowId).filter(Boolean)
  );
  const extra = remapKissflowRequestsToMaster(
    kf.requests.filter(
      (r) =>
        r.sourceProcessId !== process.env.KISSFLOW_PROCESS_ID ||
        !knownKissflowIds.has(r.kissflowId)
    ),
    kf.employees,
    sbEmployees
  );
  const merged = await applyExportLog([...sbRequests, ...extra]);
  return opts?.allDates ? merged : filterReportingWindow(merged);
}

/**
 * Leave register + payroll export source. Supabase supplies the staff master;
 * Kissflow supplies live requests that match someone in that master.
 */
export async function getKissflowRegister(): Promise<{
  employees: Employee[];
  requests: LeaveRequest[];
  source: "kissflow" | "unavailable";
}> {
  if (!usingKissflow) {
    return { employees: [], requests: [], source: "unavailable" };
  }
  const { employees: kissflowEmployees, requests: kissflowRequests } =
    await getKissflowData();
  if (usingSupabase) {
    const employees = await getSupabaseEmployees();
    const requests = remapKissflowRequestsToMaster(
      kissflowRequests,
      kissflowEmployees,
      employees
    );
    return {
      employees,
      requests: filterReportingWindow(await applyExportLog(requests)),
      source: "kissflow",
    };
  }
  return {
    employees: await applyEmployeeStatus(kissflowEmployees),
    requests: filterReportingWindow(await applyExportLog(kissflowRequests)),
    source: "kissflow",
  };
}

export function computeBalances(
  employees: Employee[],
  requests: LeaveRequest[]
): LeaveBalance[] {
  return computeBalancesBcea(employees, requests);
}
