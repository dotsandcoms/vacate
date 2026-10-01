import assert from 'node:assert/strict';
import { payrollRow, payrollFile, defaultPayrollOptions as options, validOptions } from '../lib/payroll';
import type { Employee, LeaveRequest } from '../lib/types';
const request = { type: 'Annual', startDate: '2026-09-28', endDate: '2026-09-30', days: 3, kissflowId: 'KF-001' } as LeaveRequest;
const employee = { employeeNo: '000123' } as Employee;
assert.deepEqual(payrollRow(request, employee, options).fields, ['000123', '0001', 'N', '28/09/2026', '30/09/2026', '3.00', 'KF-001']);
assert.equal(payrollFile([payrollRow(request, employee, options).fields], options), '000123,0001,N,28/09/2026,30/09/2026,3.00,KF-001\r\n');
for (const change of [{ type: 'Study' }, { days: 1000 }, { days: 0 }, { days: 1.234 }, { days: NaN }, { startDate: '2026-02-30' }, { endDate: '2026-09-01' }]) {
  assert.ok(payrollRow({ ...request, ...change } as LeaveRequest, employee, options).issues.length);
}
assert.ok(payrollRow(request, undefined, options).issues.length);
assert.ok(payrollRow(request, { ...employee, employeeNo: '123456789' }, options).issues.length);
assert.ok(payrollRow(request, employee, options, 'a'.repeat(31)).issues.length);
assert.equal(payrollRow({ ...request, type: 'Sick', days: 0.5 }, employee, options).fields[1], '0020');
assert.equal(payrollRow({ ...request, type: 'Family Responsibility' }, employee, options).fields[1], '0003');
assert.equal(payrollFile([['a,b', 'a"b']], options), '"a,b","a""b"\r\n');
assert.equal(validOptions({ ...options, payOut: 'X' }), false);
console.log('Payroll export format checks passed.');
