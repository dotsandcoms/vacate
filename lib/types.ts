export type LeaveType =
  | "Annual"
  | "Sick"
  | "Family Responsibility"
  | "Maternity/Paternity"
  | "Study"
  | "Unpaid";

export type LeaveStatus =
  | "Awaiting Approval"
  | "Approved"
  | "Pending Sync"
  | "Exported"
  | "Rejected"
  | "Cancelled";

export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  role: string;
  annualEntitlement: number; // days per cycle
  sickEntitlement: number;
  /** Estimated cost per working day in Rand — used for leave liability.
   *  Placeholder until real salary data is imported. */
  dailyCostR?: number;
}

export interface LeaveRequest {
  id: string;
  kissflowId: string; // request ID from Kissflow
  employeeId: string;
  type: LeaveType;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  days: number;
  status: LeaveStatus;
  approvedBy: string;
  approvedAt: string;
  notes?: string;
  exportedAt?: string | null;
  /** When the request was submitted in Kissflow. */
  submittedAt?: string;
  /** Who the request is currently waiting on (workflow assignee). */
  currentAssignee?: string;
  /** Whether a supporting document (e.g. sick note) is attached. */
  hasAttachment?: boolean;
  /** Rejection note entered by the approver in Kissflow. */
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  /** Workflow progress (0–100) — meaningful for multi-step approvals. */
  approvalProgress?: number;
  /** Name of the workflow step the item is currently sitting at. */
  currentStep?: string;
}

export interface LeaveBalance {
  employeeId: string;
  type: LeaveType;
  entitled: number;
  taken: number;
  remaining: number;
}
