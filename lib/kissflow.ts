// Server-side Kissflow client — pulls leave requests straight from the
// Kissflow Process API using the Vacate Leave Sync service account.
// Never import this from a client component: the access keys must stay
// on the server.
import { Employee, LeaveRequest, LeaveStatus, LeaveType } from "./types";
import { workingDays } from "./holidays";

const subdomain = process.env.KISSFLOW_SUBDOMAIN; // e.g. "utf"
const accountId = process.env.KISSFLOW_ACCOUNT_ID; // e.g. "Ac4onwiPboXl"
const processId = process.env.KISSFLOW_PROCESS_ID; // e.g. "Staff_Leave_Request_Test"
const keyId = process.env.KISSFLOW_ACCESS_KEY_ID;
const keySecret = process.env.KISSFLOW_ACCESS_KEY_SECRET;

export const usingKissflow = Boolean(
  subdomain && accountId && processId && keyId && keySecret
);

const PAGE_SIZE = 50;

async function fetchItemsPage(page: number): Promise<any> {
  const url = `https://${subdomain}.kissflow.com/process/2/${accountId}/admin/${processId}/item?page_number=${page}&page_size=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: {
      "X-Access-Key-Id": keyId!,
      "X-Access-Key-Secret": keySecret!,
    },
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
  for (let page = 1; page <= 40; page++) {
    const data = await fetchItemsPage(page);
    const rows: any[] = data?.Data ?? [];
    items.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return items;
}

interface NoteEntry {
  Note?: string;
  Type?: string; // "reject", etc.
  NotifiedAt?: string;
  NotifiedBy?: { Name?: string };
}

/** System fields like the rejection note aren't in the default item list —
 *  they must be requested explicitly via a POST column selection. */
async function fetchSystemFields(): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const body = JSON.stringify({
    Columns: [
      { Id: "_id" },
      { Id: "_status" },
      { Id: "_note" },
      { Id: "_submitted_at" },
      { Id: "_completed_at" },
      { Id: "_modified_by" },
      { Id: "_progress" },
      { Id: "_current_context" },
    ],
  });
  for (let page = 1; page <= 40; page++) {
    const url = `https://${subdomain}.kissflow.com/process/2/${accountId}/admin/${processId}/item?page_number=${page}&page_size=${PAGE_SIZE}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Access-Key-Id": keyId!,
        "X-Access-Key-Secret": keySecret!,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });
    if (!res.ok) break; // non-fatal: we just won't have notes
    const data = await res.json();
    const rows: any[] = data?.Data ?? [];
    for (const row of rows) map.set(row._id, row);
    if (rows.length < PAGE_SIZE) break;
  }
  return map;
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

// Small in-memory cache so dashboard + register don't double-hit the API
// within the same few seconds.
let cache: { at: number; promise: Promise<KissflowData> } | null = null;
const CACHE_MS = 15_000;

export function getKissflowData(): Promise<KissflowData> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const promise = loadKissflowData();
  cache = { at: Date.now(), promise };
  promise.catch(() => (cache = null)); // don't cache failures
  return promise;
}

async function loadKissflowData(): Promise<KissflowData> {
  const [items, systemFields] = await Promise.all([
    fetchAllItems(),
    fetchSystemFields(),
  ]);

  const employeesById = new Map<string, Employee>();
  const requests: LeaveRequest[] = [];

  for (const item of items) {
    const name = employeeName(item);
    const empNo =
      item.Employee_Number != null ? String(item.Employee_Number) : "";
    const empId = empNo || item._created_by?._id || name;

    if (!employeesById.has(empId)) {
      employeesById.set(empId, {
        id: empId,
        employeeNo: empNo || "—",
        name,
        department: "—", // not on the Kissflow form (yet)
        role: "—",
        // Placeholder entitlements until the Excel balances are imported.
        annualEntitlement: 15,
        sickEntitlement: 30,
      });
    }

    const startDate = item.First_Day_of_Leave ?? "";
    const endDate = item.Last_Day_of_Leave ?? startDate;
    if (!startDate) continue; // skip drafts with no dates yet

    const hasAttachment =
      (Array.isArray(item.attachment_1) && item.attachment_1.length > 0) ||
      (Array.isArray(item.Attachment_IDPassport_copy) &&
        item.Attachment_IDPassport_copy.length > 0);

    const sys = systemFields.get(item._id);
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
      notes: item.who_will_stand_in_for_you_whilst_on_leave
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
