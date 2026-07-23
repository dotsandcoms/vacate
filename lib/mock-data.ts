import { Employee, LeaveRequest } from "./types";

export const employees: Employee[] = [
  { id: "e1", employeeNo: "EMP001", name: "Thandi Nkosi", department: "Finance", role: "Financial Manager", annualEntitlement: 18, sickEntitlement: 30 },
  { id: "e2", employeeNo: "EMP002", name: "James van der Merwe", department: "Operations", role: "Ops Lead", annualEntitlement: 18, sickEntitlement: 30 },
  { id: "e3", employeeNo: "EMP003", name: "Priya Naidoo", department: "HR", role: "HR Officer", annualEntitlement: 18, sickEntitlement: 30 },
  { id: "e4", employeeNo: "EMP004", name: "Sipho Dlamini", department: "Sales", role: "Account Executive", annualEntitlement: 15, sickEntitlement: 30 },
  { id: "e5", employeeNo: "EMP005", name: "Emma Botha", department: "Marketing", role: "Marketing Coordinator", annualEntitlement: 15, sickEntitlement: 30 },
  { id: "e6", employeeNo: "EMP006", name: "Daniel Okafor", department: "IT", role: "Systems Administrator", annualEntitlement: 18, sickEntitlement: 30 },
  { id: "e7", employeeNo: "EMP007", name: "Lerato Mokoena", department: "Finance", role: "Bookkeeper", annualEntitlement: 15, sickEntitlement: 30 },
  { id: "e8", employeeNo: "EMP008", name: "Michael Chen", department: "Operations", role: "Logistics Planner", annualEntitlement: 15, sickEntitlement: 30 },
  { id: "e9", employeeNo: "EMP009", name: "Zanele Khumalo", department: "Sales", role: "Sales Manager", annualEntitlement: 18, sickEntitlement: 30 },
  { id: "e10", employeeNo: "EMP010", name: "Pieter Steyn", department: "IT", role: "Developer", annualEntitlement: 15, sickEntitlement: 30 },
  { id: "e11", employeeNo: "EMP011", name: "Aisha Patel", department: "HR", role: "Recruiter", annualEntitlement: 15, sickEntitlement: 30 },
  { id: "e12", employeeNo: "EMP012", name: "Johan Kruger", department: "Operations", role: "Warehouse Supervisor", annualEntitlement: 15, sickEntitlement: 30 },
];

export const leaveRequests: LeaveRequest[] = [
  { id: "l1", kissflowId: "KF-2026-0101", employeeId: "e1", type: "Annual", startDate: "2026-07-20", endDate: "2026-07-24", days: 5, status: "Pending Sync", approvedBy: "CFO", approvedAt: "2026-07-15T09:12:00Z" },
  { id: "l2", kissflowId: "KF-2026-0102", employeeId: "e4", type: "Sick", startDate: "2026-07-16", endDate: "2026-07-17", days: 2, status: "Pending Sync", approvedBy: "Zanele Khumalo", approvedAt: "2026-07-16T07:40:00Z", notes: "Doctor's note received" },
  { id: "l3", kissflowId: "KF-2026-0095", employeeId: "e2", type: "Annual", startDate: "2026-08-03", endDate: "2026-08-14", days: 10, status: "Approved", approvedBy: "COO", approvedAt: "2026-07-10T11:00:00Z" },
  { id: "l4", kissflowId: "KF-2026-0090", employeeId: "e6", type: "Study", startDate: "2026-07-27", endDate: "2026-07-28", days: 2, status: "Approved", approvedBy: "IT Manager", approvedAt: "2026-07-08T14:22:00Z" },
  { id: "l5", kissflowId: "KF-2026-0088", employeeId: "e5", type: "Annual", startDate: "2026-07-06", endDate: "2026-07-10", days: 5, status: "Exported", approvedBy: "CMO", approvedAt: "2026-06-28T10:05:00Z", exportedAt: "2026-06-30T08:00:00Z" },
  { id: "l6", kissflowId: "KF-2026-0086", employeeId: "e7", type: "Family Responsibility", startDate: "2026-07-02", endDate: "2026-07-02", days: 1, status: "Exported", approvedBy: "Thandi Nkosi", approvedAt: "2026-07-01T08:30:00Z", exportedAt: "2026-07-03T08:00:00Z" },
  { id: "l7", kissflowId: "KF-2026-0084", employeeId: "e9", type: "Annual", startDate: "2026-09-14", endDate: "2026-09-18", days: 5, status: "Approved", approvedBy: "CEO", approvedAt: "2026-07-05T16:45:00Z" },
  { id: "l8", kissflowId: "KF-2026-0082", employeeId: "e10", type: "Sick", startDate: "2026-06-22", endDate: "2026-06-24", days: 3, status: "Exported", approvedBy: "IT Manager", approvedAt: "2026-06-22T09:00:00Z", exportedAt: "2026-06-30T08:00:00Z" },
  { id: "l9", kissflowId: "KF-2026-0104", employeeId: "e3", type: "Annual", startDate: "2026-07-21", endDate: "2026-07-22", days: 2, status: "Pending Sync", approvedBy: "HR Manager", approvedAt: "2026-07-16T13:15:00Z" },
  { id: "l10", kissflowId: "KF-2026-0079", employeeId: "e8", type: "Annual", startDate: "2026-08-24", endDate: "2026-08-28", days: 5, status: "Approved", approvedBy: "James van der Merwe", approvedAt: "2026-07-02T10:10:00Z" },
  { id: "l11", kissflowId: "KF-2026-0075", employeeId: "e11", type: "Maternity/Paternity", startDate: "2026-09-01", endDate: "2026-12-24", days: 82, status: "Approved", approvedBy: "HR Manager", approvedAt: "2026-06-20T09:30:00Z" },
  { id: "l12", kissflowId: "KF-2026-0071", employeeId: "e12", type: "Annual", startDate: "2026-07-13", endDate: "2026-07-15", days: 3, status: "Exported", approvedBy: "James van der Merwe", approvedAt: "2026-06-25T15:00:00Z", exportedAt: "2026-06-30T08:00:00Z" },
  { id: "l13", kissflowId: "KF-2026-0105", employeeId: "e12", type: "Sick", startDate: "2026-07-17", endDate: "2026-07-17", days: 1, status: "Pending Sync", approvedBy: "James van der Merwe", approvedAt: "2026-07-17T07:55:00Z" },
  { id: "l14", kissflowId: "KF-2026-0068", employeeId: "e1", type: "Annual", startDate: "2026-04-06", endDate: "2026-04-10", days: 5, status: "Exported", approvedBy: "CFO", approvedAt: "2026-03-20T09:00:00Z", exportedAt: "2026-03-31T08:00:00Z" },
  { id: "l15", kissflowId: "KF-2026-0060", employeeId: "e4", type: "Annual", startDate: "2026-03-16", endDate: "2026-03-20", days: 5, status: "Exported", approvedBy: "Zanele Khumalo", approvedAt: "2026-03-01T09:00:00Z", exportedAt: "2026-03-31T08:00:00Z" },
];
