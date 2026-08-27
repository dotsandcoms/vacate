// Server-side Kissflow client — pulls leave requests straight from the
// Kissflow Process API using the Vacate Leave Sync service account.
// Never import this from a client component: the access keys must stay
// on the server.
import { Employee, LeaveRequest, LeaveStatus, LeaveType } from "./types";
import { workingDays } from "./holidays";
import { unstable_cache } from "next/cache";

const subdomain = process.env.KISSFLOW_SUBDOMAIN; // e.g. "utf"
const accountId = process.env.KISSFLOW_ACCOUNT_ID; // e.g. "Ac4onwiPboXl"
const primaryProcessId = process.env.KISSFLOW_PROCESS_ID; // e.g. "Staff_Leave_Request_Test"
const keyId = process.env.KISSFLOW_ACCESS_KEY_ID;
const keySecret = process.env.KISSFLOW_ACCESS_KEY_SECRET;

interface ProcessDefinition {
  id: string;
  fixedType?: LeaveType;
  requireEmployeeNumber?: boolean;
  fields: {
    employeeName: string[];
    employeeNumber: string[];
    startDate: string[];
    endDate: string[];
    attachment: string[];
    notes?: string[];
  };
}

const SYSTEM_COLUMNS = [
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
];

const configuredProcesses: ProcessDefinition[] = [
  ...(primaryProcessId
    ? [
        {
          id: primaryProcessId,
          requireEmployeeNumber: true,
          fields: {
            employeeName: ["Staff_Name", "Staff_Name_1", "Staff_Nam"],
            employeeNumber: ["Employee_Number"],
            startDate: ["First_Day_of_Leave"],
            endDate: ["Last_Day_of_Leave"],
            attachment: [
              "Form_Attachment",
              "attachment_1",
              "Attachment_IDPassport_copy",
            ],
          },
        } satisfies ProcessDefinition,
      ]
    : []),
  {
    id:
      process.env.KISSFLOW_FAMILY_PROCESS_ID ||
      "Family_Responsibility_lapses_at_end_of_l",
    fixedType: "Family Responsibility",
    fields: {
      employeeName: ["Staff_Members_Name"],
      employeeNumber: ["Employee_Number"],
      startDate: ["Date_From"],
      endDate: ["Date_to"],
      attachment: ["Required_Documentation", "Form_Attachment"],
      notes: ["Comments"],
    },
  },
  {
    id: process.env.KISSFLOW_SICK_PROCESS_ID || "Sick_Leave_Register",
    fixedType: "Sick",
    fields: {
      employeeName: ["Staff_member", "Staff_memember"],
      employeeNumber: ["Employee_Number"],
      startDate: ["st_day_off_date"],
      endDate: ["Last_day_off_date"],
      attachment: [
        "Attaches_Doctors_Note",
        "Form_Attachment",
        "Attachment_IDPassport_copy",
      ],
    },
  },
];

// Avoid double-reading a process if one of the optional IDs is configured to
// the same value as another source.
const processes = configuredProcesses.filter(
  (process, index, all) => all.findIndex((item) => item.id === process.id) === index
);

export const usingKissflow = Boolean(
  subdomain && accountId && processes.length && keyId && keySecret
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

const PRIMARY_EXTRA_COLUMNS = [
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
];

function itemColumns(process: ProcessDefinition) {
  const ids = new Set([
    ...SYSTEM_COLUMNS,
    ...process.fields.employeeName,
    ...process.fields.employeeNumber,
    ...process.fields.startDate,
    ...process.fields.endDate,
    ...process.fields.attachment,
    ...(process.fields.notes ?? []),
    ...(process.id === primaryProcessId ? PRIMARY_EXTRA_COLUMNS : []),
  ]);
  return Array.from(ids, (Id) => ({ Id }));
}

async function fetchItemsPage(
  process: ProcessDefinition,
  page: number
): Promise<any> {
  const url = `https://${subdomain}.kissflow.com/process/2/${accountId}/admin/${process.id}/item?page_number=${page}&page_size=${PAGE_SIZE}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Access-Key-Id": keyId!,
      "X-Access-Key-Secret": keySecret!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Columns: itemColumns(process) }),
    // Always fetch fresh — the dashboard is meant to be live.
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Kissflow process ${process.id} API ${res.status}: ${body.slice(0, 300)}`
    );
  }
  return res.json();
}

async function fetchAllItems(process: ProcessDefinition): Promise<any[]> {
  const items: any[] = [];
  const firstData = await fetchItemsPage(process, 1);
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
    const pages = await Promise.all(
      pageNumbers.map((page) => fetchItemsPage(process, page))
    );
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

function firstFieldValue(item: any, fieldIds: string[]) {
  for (const fieldId of fieldIds) {
    const value = item[fieldId];
    if (value != null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function displayValue(value: any): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const nested = value.Name ?? value.name ?? value.value;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return undefined;
}

function employeeName(item: any, process: ProcessDefinition): string {
  for (const fieldId of process.fields.employeeName) {
    const value = displayValue(item[fieldId]);
    if (value) return value;
  }
  return item._created_by?.Name ?? "Unknown";
}

function employeeNumber(item: any, process: ProcessDefinition) {
  const raw = displayValue(
    firstFieldValue(item, process.fields.employeeNumber)
  );
  return raw ? EMPLOYEE_NUMBER_ALIASES[raw] ?? raw : undefined;
}

function hasFieldValue(value: any): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value != null && String(value).trim() !== "";
}

function syntheticEmployeeId(process: ProcessDefinition, item: any, name: string) {
  const reference = firstFieldValue(item, process.fields.employeeName);
  const referenceId =
    reference && typeof reference === "object" ? reference._id : undefined;
  return `${process.id}:staff:${referenceId ?? name.toLowerCase()}`;
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
    "kissflow-process-data-v3-multi-process",
    subdomain ?? "",
    accountId ?? "",
    ...processes.map((process) => process.id),
  ],
  { revalidate: 60, tags: ["kissflow-leave-processes"] }
);

export function getKissflowData(): Promise<KissflowData> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const promise = getPersistedKissflowData();
  cache = { at: Date.now(), promise };
  promise.catch(() => (cache = null)); // don't cache failures
  return promise;
}

async function loadKissflowData(): Promise<KissflowData> {
  const results = await Promise.allSettled(
    processes.map(async (process) => ({
      process,
      items: await fetchAllItems(process),
    }))
  );
  const successful = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.error(
      `[vacate] Unable to read Kissflow process ${processes[index].id}`,
      result.reason
    );
    return [];
  });
  if (successful.length === 0) {
    throw new Error("None of the configured Kissflow leave processes could be read");
  }

  const allEmployees = new Map<string, Employee>();
  const allRequests: LeaveRequest[] = [];
  const { detectSyncEvents } = await import("./notifications");

  for (const { process, items } of successful) {
    const processEmployees = new Map<string, Employee>();
    const processRequests: LeaveRequest[] = [];

    for (const item of items) {
      const name = employeeName(item, process);
      const empNo = employeeNumber(item, process);
      if (process.requireEmployeeNumber && !empNo) continue;
      const empId = empNo ?? syntheticEmployeeId(process, item, name);
      const startDate = displayValue(
        firstFieldValue(item, process.fields.startDate)
      );
      const endDate =
        displayValue(firstFieldValue(item, process.fields.endDate)) ?? startDate;
      if (!startDate || !endDate) continue;

      if (!processEmployees.has(empId)) {
        processEmployees.set(empId, {
          id: empId,
          employeeNo: empNo ?? "",
          name,
          department: "—",
          role: "—",
          annualEntitlement: 15,
          sickEntitlement: 30,
          active: true,
        });
      }

      const rejection = rejectionFromNotes(item._note);
      const assignees: string[] = (item._current_assigned_to ?? [])
        .map((assignee: any) => assignee?.Name)
        .filter(Boolean);
      const context = item._current_context;
      const currentStep: string | undefined = Array.isArray(context)
        ? context
            .map((entry: any) => entry?.Name ?? entry?.ActivityName)
            .filter(Boolean)
            .join(", ") || undefined
        : context?.Name ?? context?.ActivityName ?? undefined;
      const configuredNote = displayValue(
        firstFieldValue(item, process.fields.notes ?? [])
      );
      const standIn = item.Who_will_stand_in_for_you_whilst?.Name
        ? `Stand-in: ${item.Who_will_stand_in_for_you_whilst.Name}`
        : item.who_will_stand_in_for_you_whilst_on_leave
        ? `Stand-in: ${item.who_will_stand_in_for_you_whilst_on_leave}`
        : undefined;

      processRequests.push({
        id:
          process.id === primaryProcessId
            ? item._id
            : `${process.id}:${item._id}`,
        kissflowId: item._id,
        sourceProcessId: process.id,
        employeeId: empId,
        type: process.fixedType ?? mapLeaveType(item),
        startDate,
        endDate,
        days: workingDays(startDate, endDate),
        status: mapStatus(item._status),
        approvedBy:
          item._status === "Completed" ? item._modified_by?.Name ?? "" : "",
        approvedAt:
          (item._status === "Completed" ? item._completed_at : undefined) ??
          item._modified_at ??
          item._created_at ??
          "",
        notes: configuredNote ?? standIn,
        exportedAt: null,
        submittedAt: item._submitted_at ?? item._created_at ?? undefined,
        rejectionReason: rejection?.reason,
        rejectedBy: rejection?.by,
        rejectedAt: rejection?.at,
        currentAssignee:
          item._status !== "Completed" && assignees.length
            ? assignees.join(", ")
            : undefined,
        currentStep,
        approvalProgress:
          typeof item._progress === "number" ? item._progress : undefined,
        hasAttachment: process.fields.attachment.some((fieldId) =>
          hasFieldValue(item[fieldId])
        ),
      });
    }

    const employees = Array.from(processEmployees.values());
    await detectSyncEvents(
      processRequests,
      employees,
      `kissflow:${process.id}`
    );
    for (const employee of employees) allEmployees.set(employee.id, employee);
    allRequests.push(...processRequests);
  }

  return {
    employees: Array.from(allEmployees.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    requests: allRequests,
  };
}
