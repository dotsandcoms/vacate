import type { LeaveRequest, LeaveType } from "./types";

export const LEAVE_TYPES: readonly LeaveType[] = [
  "Annual", "Sick", "Family Responsibility", "Maternity/Paternity", "Study", "Unpaid",
];

export type LeaveAdjustmentInput =
  | {
      employeeId: string;
      requestId: string;
      reason: string;
      excluded: true;
    }
  | {
      employeeId: string;
      requestId: string;
      reason: string;
      excluded?: false;
      type: LeaveType;
      startDate: string;
      endDate: string;
      days: number;
    };

export interface StoredLeaveAdjustment {
  employee_id: string;
  kissflow_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  excluded: boolean;
  adjusted_by_name: string;
  created_at: string;
  previous_values: Pick<LeaveRequest, "type" | "startDate" | "endDate" | "days">;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validIds(input: Record<string, unknown>) {
  if (typeof input.employeeId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.employeeId)
      || typeof input.requestId !== "string" || !input.requestId.trim() || input.requestId.length > 300) {
    throw new Error("Choose an employee and leave record.");
  }
}

function validReason(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 1000) {
    throw new Error("Enter a reason for the correction (up to 1,000 characters).");
  }
  return value.trim();
}

export function validateLeaveAdjustment(value: unknown): LeaveAdjustmentInput {
  if (!value || typeof value !== "object") throw new Error("Enter the leave correction details.");
  const input = value as Record<string, unknown>;
  validIds(input);
  const reason = validReason(input.reason);
  const employeeId = input.employeeId as string;
  const requestId = input.requestId as string;

  if (input.excluded === true) {
    return { employeeId, requestId, reason, excluded: true };
  }

  if (!LEAVE_TYPES.includes(input.type as LeaveType)) throw new Error("Choose a valid leave type.");
  if (!validDate(input.startDate) || !validDate(input.endDate) || input.endDate < input.startDate) {
    throw new Error("Enter valid dates, with the end on or after the start.");
  }
  if (typeof input.days !== "number" || !Number.isFinite(input.days) || input.days <= 0 || input.days > 366
      || Math.abs(input.days * 100 - Math.round(input.days * 100)) > 0.000001) {
    throw new Error("Enter days between 0.01 and 366, with up to two decimal places.");
  }
  const calendarDays = (Date.parse(input.endDate) - Date.parse(input.startDate)) / 86400000 + 1;
  if (input.days > calendarDays) throw new Error("Leave days cannot exceed the number of days in the date range.");
  return {
    employeeId, requestId, reason, excluded: false,
    type: input.type as LeaveType, startDate: input.startDate, endDate: input.endDate, days: input.days,
  };
}

/** Leave that still reduces balances / appears in payroll queues. */
export function isLeaveCounted(request: LeaveRequest): boolean {
  return !request.adjustment?.excluded;
}

/** Status label for tables and history, including manual exclusions. */
export function leaveDisplayStatus(request: LeaveRequest): string {
  return request.adjustment?.excluded ? "Not counted" : request.status;
}

/** Apply adjustments in audit ID order, after merging the live and stored sources. */
export function overlayLeaveAdjustments(
  requests: LeaveRequest[],
  adjustments: StoredLeaveAdjustment[]
): LeaveRequest[] {
  const latest = new Map(adjustments.map((row) => [`${row.employee_id}:${row.kissflow_id}`, row]));
  const original = new Map<string, StoredLeaveAdjustment["previous_values"]>();
  for (const row of adjustments) {
    const key = `${row.employee_id}:${row.kissflow_id}`;
    if (!original.has(key)) original.set(key, row.previous_values);
  }
  return requests.map((request) => {
    const row = latest.get(`${request.employeeId}:${request.kissflowId}`);
    if (!row) return request;
    return {
      ...request,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      days: Number(row.days),
      adjustment: {
        reason: row.reason,
        adjustedBy: row.adjusted_by_name,
        adjustedAt: row.created_at,
        excluded: row.excluded === true,
        original: original.get(`${request.employeeId}:${request.kissflowId}`)!,
      },
    };
  });
}
