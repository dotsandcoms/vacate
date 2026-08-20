// Server-side Kissflow client — pulls leave requests straight from the
// Kissflow Process API using the Vacate Leave Sync service account.
// Never import this from a client component: the access keys must stay
// on the server.
import { Employee, LeaveRequest, LeaveStatus, LeaveType } from "./types";
import { workingDays } from "./holidays";
import { unstable_cache } from "next/cache";

const subdomain = process.env.KISSFLOW_SUBDOMAIN; // e.g. "utf"
const accountId = process.env.KISSFLOW_ACCOUNT_ID; // e.g. "Ac4onwiPboXl"
const processId = process.env.KISSFLOW_PROCESS_ID; // e.g. "Staff_Leave_Request_Test"
const keyId = process.env.KISSFLOW_ACCESS_KEY_ID;
const keySecret = process.env.KISSFLOW_ACCESS_KEY_SECRET;

export const usingKissflow = Boolean(
  subdomain && accountId && processId && keyId && keySecret
);

// The API accepts arbitrary page sizes. This process currently has ~2,500
// items, so one 5,000-row response avoids an expensive pagination waterfall.
// fetchAllItems still handles additional pages if the process outgrows it.
const PAGE_SIZE = 5_000;

// Known Kissflow data-entry corrections. Keep the historical request intact
// while joining it to the employee's canonical number in the dashboard.
const EMPLOYEE_NUMBER_ALIASES: Record<string, string> = {
  "2050": "250",
};

// Request form and workflow fields together. Kissflow's column-selection POST
// returns both, avoiding a second full paginated sweep for system metadata.
const ITEM_COLUMNS = [
  "_id",
  "_status",
  "_note",
  "_submitted_at",
  "_completed_at",
  "_modified_by",
  "_modified_at",
  "_created_at",
  "_created_by",
  "_progress",
  "_current_context",
  "_current_assigned_to",
  "Staff_Name",
  "Staff_Name_1",
  "Staff_Nam",
  "Employee_Number",
  "First_Day_of_Leave",
  "Last_Day_of_Leave",
  "Leave_Type",
  "Type_of_Leave",
  "LeaveType",
  "Leave_type",
  "Who_will_stand_in_for_you_whilst",
  "who_will_stand_in_for_you_whilst_on_leave",
  "Form_Attachment",
  "attachment_1",
  "Attachment_IDPassport_copy",
].map((Id) => ({ Id }));

async function fetchItemsPage(page: number): Promise<any> {
  const url = `https://${subdomain}.kissflow.com/process/2/${accountId}/admin/${processId}/item?page_number=${page}&page_size=${PAGE_SIZE}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Access-Key-Id": keyId!,
      "X-Access-Key-Secret": keySecret!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Columns: ITEM_COLUMNS }),
    // Always fetch fresh — the dashboard is meant to be live.
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kissflow API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchAllItems(): Promise<any[]> {
  const items: any[] = [];
  const firstData = await fetchItemsPage(1);
  const firstRows: any[] = firstData?.Data ?? [];
  items.push(...firstRows);
  if (firstRows.length < PAGE_SIZE) return items;

  // Kissflow does not expose a reliable total here. Fetch subsequent pages in
  // modest parallel batches to avoid a long sequential waterfall without
  // creating an aggressive burst against the API.
  const concurrency = 4;
  for (let start = 2; start <= 40; start += concurrency) {
    const pageNumbers = Array.from(
      { length: Math.min(concurrency, 41 - start) },
      (_, index) => start + index
    );
    const pages = await Promise.all(pageNumbers.map(fetchItemsPage));
    let reachedEnd = false;
    for (const data of pages) {
      if (reachedEnd) break;
      const rows: any[] = data?.Data ?? [];
      items.push(...rows);
      reachedEnd = rows.length < PAGE_SIZE;
    }
    if (reachedEnd) break;
  }
  return items;
}

interface NoteEntry {
  Note?: string;
  Type?: string; // "reject", etc.
  NotifiedAt?: string;
  NotifiedBy?: { Name?: string };
}

function rejectionFromNotes(notes: NoteEntry[] | undefined) {
  if (!Array.isArray(notes)) return null;
  const rej = [...notes].reverse().find((n) => n.Type === "reject" && n.Note);
  if (!rej) return null;
  return {
    reason: rej.Note!,
    by: rej.NotifiedBy?.Name,
    at: rej.NotifiedAt,
  };
}

function mapStatus(kfStatus: string): LeaveStatus {
  switch (kfStatus) {
    case "Completed":
      return "Approved"; // shows as Exported once it lands in a payroll batch
    case "Rejected":
      return "Rejected";
    case "Withdrawn":
      return "Cancelled";
    default:
      return "Awaiting Approval"; // Draft / InProgress
  }
}

const KNOWN_TYPES: LeaveType[] = [
  "Annual",
  "Sick",
  "Family Responsibility",
  "Maternity/Paternity",
  "Study",
  "Unpaid",
];

/** The form has no Leave Type field yet — probe likely field ids so it
 *  starts working the moment the field is added in Kissflow. */
function mapLeaveType(item: any): LeaveType {
  const candidates = [
    item.Leave_Type,
    item.Type_of_Leave,
    item.LeaveType,
    item.Leave_type,
  ];
  for (const c of candidates) {
    const v = typeof c === "object" && c !== null ? c.Name ?? c.value : c;
    if (typeof v === "string") {
      const match = KNOWN_TYPES.find(
        (t) => t.toLowerCase() === v.toLowerCase()
      );
      if (match) return match;
    }
  }
  return "Annual";
}

function employeeName(item: any): string {
  const staffSelect = item.Staff_Name;
  if (typeof staffSelect === "string" && staffSelect.trim()) return staffSelect;
  if (staffSelect && typeof staffSelect === "object" && staffSelect.Name)
    return staffSelect.Name;
  if (typeof item.Staff_Name_1 === "string" && item.Staff_Name_1.trim())
    return item.Staff_Name_1;
  return item._created_by?.Name ?? "Unknown";
}

export interface KissflowData {
  employees: Employee[];
  requests: LeaveRequest[];
}

// L1 cache de-duplicates calls inside one server process. The Next data cache
// below is shared across requests/instances so a profile navigation does not
// trigger another full Kissflow scan on a different worker.
let cache: { at: number; promise: Promise<KissflowData> } | null = null;
const CACHE_MS = 60_000;

const getPersistedKissflowData = unstable_cache(
  loadKissflowData,
  [
    "kissflow-process-data-v2-single-page",
    subdomain ?? "",
    accountId ?? "",
    processId ?? "",
  ],
  { revalidate: 60, tags: [`kissflow-process-${processId ?? "unknown"}`] }
);

export function getKissflowData(): Promise<KissflowData> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const promise = getPersistedKissflowData();
  cache = { at: Date.now(), promise };
  promise.catch(() => (cache = null)); // don't cache failures
  return promise;
}

async function loadKissflowData(): Promise<KissflowData> {
  const items = await fetchAllItems();

  const employeesById = new Map<string, Employee>();
  const requests: LeaveRequest[] = [];

  for (const item of items) {
    // Historical records without an employee number cannot be joined to a
    // canonical staff member reliably. Hide them until a cleanup/mapping
    // policy is agreed instead of creating duplicate creator-based identities.
    if (item.Employee_Number == null || String(item.Employee_Number).trim() === "") {
      continue;
    }

    const name = employeeName(item);
    const rawEmpNo = String(item.Employee_Number).trim();
    const empNo = EMPLOYEE_NUMBER_ALIASES[rawEmpNo] ?? rawEmpNo;
    const empId = empNo;

    if (!employeesById.has(empId)) {
      employeesById.set(empId, {
        id: empId,
        employeeNo: empNo,
        name,
        department: "—", // not on the Kissflow form (yet)
        role: "—",
        // Placeholder entitlements until the Excel balances are imported.
        annualEntitlement: 15,
        sickEntitlement: 30,
        active: true,
      });
    }

    const startDate = item.First_Day_of_Leave ?? "";
    const endDate = item.Last_Day_of_Leave ?? startDate;
    if (!startDate) continue; // skip drafts with no dates yet

    const hasAttachment =
      (Array.isArray(item.Form_Attachment) && item.Form_Attachment.length > 0) ||
      (Array.isArray(item.attachment_1) && item.attachment_1.length > 0) ||
      (Array.isArray(item.Attachment_IDPassport_copy) &&
        item.Attachment_IDPassport_copy.length > 0);

    const sys = item;
    const rejection = rejectionFromNotes(sys?._note);

    // Multi-step aware: all current assignees (parallel approvers), and the
    // current step name if Kissflow exposes it in _current_context.
    const assignees: string[] = (item._current_assigned_to ?? [])
      .map((a: any) => a?.Name)
      .filter(Boolean);
    const ctx = sys?._current_context;
    const currentStep: string | undefined = Array.isArray(ctx)
      ? ctx.map((c: any) => c?.Name ?? c?.ActivityName).filter(Boolean).join(", ") || undefined
      : ctx?.Name ?? ctx?.ActivityName ?? undefined;

    requests.push({
      id: item._id,
      kissflowId: item._id,
      employeeId: empId,
      type: mapLeaveType(item),
      startDate,
      endDate,
      days: workingDays(startDate, endDate),
      status: mapStatus(item._status),
      approvedBy:
        item._status === "Completed" ? sys?._modified_by?.Name ?? "" : "",
      approvedAt:
        (item._status === "Completed" ? sys?._completed_at : undefined) ??
        item._modified_at ??
        item._created_at ??
        "",
      notes: item.Who_will_stand_in_for_you_whilst?.Name
        ? `Stand-in: ${item.Who_will_stand_in_for_you_whilst.Name}`
        : item.who_will_stand_in_for_you_whilst_on_leave
        ? `Stand-in: ${item.who_will_stand_in_for_you_whilst_on_leave}`
        : undefined,
      exportedAt: null,
      submittedAt: sys?._submitted_at ?? item._created_at ?? undefined,
      rejectionReason: rejection?.reason,
      rejectedBy: rejection?.by,
      rejectedAt: rejection?.at,
      currentAssignee:
        item._status !== "Completed" && assignees.length
          ? assignees.join(", ")
          : undefined,
      currentStep,
      approvalProgress:
        typeof sys?._progress === "number" ? sys._progress : undefined,
      hasAttachment,
    });
  }

  const employees = Array.from(employeesById.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Fire-and-forget: diff against the previous sync and record notifications.
  const { detectSyncEvents } = await import("./notifications");
  detectSyncEvents(requests, employees).catch(() => {});

  return { employees, requests };
}
