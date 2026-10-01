import type { Employee, LeaveRequest, LeaveType } from './types';

export const payrollCodes: Partial<Record<LeaveType, string>> = {
  Annual: '0001', 'Family Responsibility': '0003', Sick: '0020',
};
export const payrollHeaders = ['Employee Code', 'Transaction Code', 'Pay Out', 'Date From', 'Date To', 'Days Taken', 'Remarks'];
export interface PayrollOptions {
  dateFormat: 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'mm/dd/yyyy';
  delimiter: ',' | ';' | '\t';
  headers: boolean;
  payOut: 'N' | 'Y';
}
export const defaultPayrollOptions: PayrollOptions = { dateFormat: 'dd/mm/yyyy', delimiter: ',', headers: false, payOut: 'N' };
export function validOptions(value: unknown): value is PayrollOptions {
  if (!value || typeof value !== 'object') return false;
  const v = value as PayrollOptions;
  return ['dd/mm/yyyy', 'yyyy-mm-dd', 'mm/dd/yyyy'].includes(v.dateFormat) && [',', ';', '\t'].includes(v.delimiter) && typeof v.headers === 'boolean' && ['N', 'Y'].includes(v.payOut);
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function payrollDate(value: string, format: PayrollOptions['dateFormat']) {
  const [y, m, d] = value.split('-');
  return format === 'dd/mm/yyyy' ? `${d}/${m}/${y}` : format === 'mm/dd/yyyy' ? `${m}/${d}/${y}` : value;
}
export function payrollRow(request: LeaveRequest, employee: Employee | undefined, options: PayrollOptions, remarks = request.kissflowId) {
  const issues: string[] = [];
  const code = employee?.employeeNo ?? '';
  if (!code.trim() || Array.from(code).length > 8 || /[\r\n\t]/.test(code)) issues.push('Employee Code must contain 1–8 characters.');
  if (!payrollCodes[request.type]) issues.push(`No payroll code supplied for ${request.type}.`);
  if (!validDate(request.startDate) || !validDate(request.endDate)) issues.push('Dates must be valid calendar dates.');
  else if (request.endDate < request.startDate) issues.push('Date To must be on or after Date From.');
  if (!Number.isFinite(request.days) || request.days <= 0 || request.days > 999.99 || Math.abs(request.days * 100 - Math.round(request.days * 100)) > 1e-7) issues.push('Days Taken must be 0.01–999.99 with at most two decimal places.');
  if (Array.from(remarks).length > 30 || /[\r\n\t]/.test(remarks)) issues.push('Remarks must be at most 30 characters on one line.');
  return { issues, fields: [code, payrollCodes[request.type] ?? '', options.payOut, payrollDate(request.startDate, options.dateFormat), payrollDate(request.endDate, options.dateFormat), request.days.toFixed(2), remarks] };
}
export function payrollFile(rows: string[][], options: PayrollOptions) {
  const quote = (value: string) => /["\r\n]/.test(value) || value.includes(options.delimiter) ? `"${value.replace(/"/g, '""')}"` : value;
  return (options.headers ? [payrollHeaders, ...rows] : rows).map(row => row.map(quote).join(options.delimiter)).join('\r\n') + '\r\n';
}
