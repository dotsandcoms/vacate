const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const result = {};
    cache.set(absolute, result);
    const js = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    new Function('exports', 'require', js)(result, (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('./')) return load(path.resolve(path.dirname(absolute), `${name}.ts`));
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
      return require(name);
    });
    return result;
  }
  return load;
}

const load = loader();
const { validateLeaveAdjustment, overlayLeaveAdjustments } = load('lib/leave-adjustments.ts');
const { computeBalancesBcea } = load('lib/balances.ts');
const employeeId = 'da090757-5c88-4e94-b24f-c9204383cca5';
const request = {
  id: 'august', kissflowId: 'august', employeeId, sourceProcessId: 'Staff_Leave_Request',
  type: 'Annual', startDate: '2026-08-17', endDate: '2026-08-18', days: 2,
  status: 'Exported', exportedAt: '2026-10-09T12:00:00Z', approvedBy: 'Approver', approvedAt: '',
};
const input = {
  employeeId, requestId: request.id, type: 'Sick', startDate: request.startDate,
  endDate: request.endDate, days: 2, reason: '  August was sick leave.  ',
};
assert.equal(validateLeaveAdjustment(input).reason, 'August was sick leave.');
for (const changes of [
  { employeeId: '' }, { requestId: '' }, { type: 'Other' }, { startDate: '2026-02-30' },
  { endDate: '2026-08-16' }, { days: -1 }, { days: 0 }, { days: NaN }, { days: Infinity },
  { days: '2' }, { days: 1.234 }, { days: 3 }, { reason: ' ' }, { reason: 'x'.repeat(1001) },
]) assert.throws(() => validateLeaveAdjustment({ ...input, ...changes }));
assert.equal(validateLeaveAdjustment({ ...input, days: 0.5 }).days, 0.5);

const row = {
  employee_id: employeeId, kissflow_id: request.kissflowId, type: 'Sick',
  start_date: request.startDate, end_date: request.endDate, days: 2,
  reason: 'August was sick leave.', adjusted_by_name: 'Administrator', created_at: '2026-10-28T10:00:00Z',
  previous_values: { type: request.type, startDate: request.startDate, endDate: request.endDate, days: request.days },
};
const other = { ...request, id: 'other', employeeId: 'another-employee' };
const corrected = overlayLeaveAdjustments([request, other], [row]);
assert.equal(corrected[0].type, 'Sick');
assert.equal(corrected[0].status, 'Exported');
assert.equal(corrected[0].exportedAt, request.exportedAt);
assert.equal(corrected[0].approvedBy, request.approvedBy);
assert.equal(corrected[0].sourceProcessId, request.sourceProcessId);
assert.equal(corrected[1], other);
assert.equal(request.type, 'Annual');
// The correction survives a refresh and a change from live IDs to stored IDs.
assert.equal(overlayLeaveAdjustments([{ ...request, id: 'stored-uuid' }], [row])[0].type, 'Sick');

const employee = {
  id: employeeId, annualEntitlement: 20, sickEntitlement: 30,
  openingAnnualBalance: 7.81, openingSickBalance: 24, openingFamilyBalance: 3,
  openingBalanceAsOf: '2026-11-01', monthlyAccrual: 1.67,
};
function balances(requests, date = '2026-10-28') {
  return Object.fromEntries(computeBalancesBcea([employee], requests, date).map((balance) => [balance.type, balance]));
}
assert.equal(balances(corrected).Annual.remaining, 9.81);
assert.equal(balances(corrected).Sick.remaining, 22);
assert.equal(balances(corrected).Sick.taken, 8);
assert.equal(balances(corrected, '2026-11-30').Annual.remaining, 11.48);
const repeated = overlayLeaveAdjustments([request], [row, { ...row, days: 1, previous_values: { ...row.previous_values, type: 'Sick' } }]);
assert.equal(balances(repeated).Annual.remaining, 9.81);
assert.equal(balances(repeated).Sick.remaining, 23);
const reverted = overlayLeaveAdjustments([request], [row, { ...row, type: 'Annual', previous_values: { ...row.previous_values, type: 'Sick' } }]);
assert.equal(balances(reverted).Annual.remaining, 7.81);
assert.equal(balances(reverted).Sick.remaining, 24);
const future = overlayLeaveAdjustments([{ ...request, startDate: '2026-11-10', endDate: '2026-11-11' }], [{
  ...row, start_date: '2026-11-10', end_date: '2026-11-11',
  previous_values: { ...row.previous_values, startDate: '2026-11-10', endDate: '2026-11-11' },
}]);
assert.equal(balances(future).Annual.remaining, 7.81);
assert.equal(balances(future).Sick.remaining, 22);
// Moving the date beyond cutover refunds the historical annual deduction,
// then reserves the same annual days after cutover without double counting.
const moved = overlayLeaveAdjustments([request], [{ ...row, type: 'Annual', start_date: '2026-11-10', end_date: '2026-11-11' }]);
assert.equal(balances(moved).Annual.remaining, 7.81);
assert.equal(balances([{ ...corrected[0], status: 'Cancelled' }]).Annual.remaining, 7.81);
assert.equal(balances([{ ...corrected[0], status: 'Cancelled' }]).Sick.remaining, 24);

let currentUser = { id: 'administrator', name: 'Administrator', role: 'admin', active: true };
let inserts = [];
let databaseError = null;
const routeLoad = loader({
  'next/server': { NextRequest, NextResponse },
  './auth': { getCurrentUser: async () => currentUser },
  '@/lib/data': { getLeaveRequests: async () => [request] },
  '@/lib/supabase/server': { createAdminSupabaseClient: () => ({ from: (table) => ({ insert: async (value) => {
    assert.equal(table, 'leave_request_adjustments');
    inserts.push(value);
    return { error: databaseError };
  } }) }) },
});
const { POST } = routeLoad('app/api/leave-adjustments/route.ts');
function post(body = input, origin = 'https://example.com') {
  return POST(new NextRequest('https://example.com/api/leave-adjustments', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin, host: 'example.com' }, body: JSON.stringify(body),
  }));
}
(async () => {
  assert.equal((await post()).status, 200);
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].previous_values, row.previous_values);
  assert.equal(inserts[0].adjusted_by, currentUser.id);
  assert.equal(inserts[0].kissflow_id, request.kissflowId);
  assert.equal('status' in inserts[0], false);
  assert.equal((await post({ ...input, type: 'Annual' })).status, 400);
  assert.equal((await post({ ...input, employeeId: '12345678-1234-1234-1234-123456789012' })).status, 404);
  assert.equal((await post({ ...input, requestId: 'not-found' })).status, 404);
  assert.equal((await post({ ...input, days: -2 })).status, 400);
  assert.equal((await post(input, 'https://attacker.example')).status, 403);
  currentUser = { ...currentUser, role: 'department_manager' };
  assert.equal((await post()).status, 403);
  currentUser = { ...currentUser, role: 'cfo' };
  assert.equal((await post()).status, 403);
  currentUser = { ...currentUser, role: 'admin', active: false };
  assert.equal((await post()).status, 401);
  currentUser = null;
  assert.equal((await post()).status, 401);
  assert.equal(inserts.length, 1);
  console.log('Leave correction checks passed: validation, authorization, audit, refresh persistence, export locks and opening balances.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
