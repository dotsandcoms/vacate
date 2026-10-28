const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const result = {};
  cache.set(absolute, result);
  const js = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (name) => name.startsWith('./')
    ? load(path.resolve(path.dirname(absolute), `${name}.ts`)) : require(name);
  new Function('exports', 'require', js)(result, localRequire);
  return result;
}

const { computeBalancesBcea, monthsAccruedAfter, employeeAnnualLiabilityR, leaveLiabilityR } = load('lib/balances.ts');
const { correctedEmployeeNo, correctedEmployeeNoForStoredRequest, isUnresolvedJonoCode } = load('lib/kissflow-corrections.ts');

const employee = {
  id: 'e', employeeNo: '123', name: 'Example', department: 'Example', role: 'Example',
  annualEntitlement: 20, sickEntitlement: 30, monthlyAccrual: 1.67, dailyCostR: 200,
  openingAnnualBalance: 10.13, openingSickBalance: 24, openingFamilyBalance: 2,
  openingBalanceAsOf: '2026-11-01',
};
function request(id, type, startDate, endDate, days, status = 'Approved') {
  return { id, kissflowId: id, employeeId: 'e', type, startDate, endDate, days, status, approvedBy: '', approvedAt: '' };
}
function balance(type, date, requests = []) {
  return computeBalancesBcea([employee], requests, date).find((b) => b.type === type);
}

assert.equal(monthsAccruedAfter('2026-11-01', '2026-10-28'), 0);
assert.equal(monthsAccruedAfter('2026-11-01', '2026-11-29'), 0);
assert.equal(monthsAccruedAfter('2026-11-01', '2026-11-30'), 1);
assert.equal(monthsAccruedAfter('2026-11-01', '2026-12-30'), 1);
assert.equal(monthsAccruedAfter('2026-11-01', '2026-12-31'), 2);
const spanning = request('span', 'Annual', '2026-10-29', '2026-11-03', 4);
const future = request('future', 'Annual', '2026-11-10', '2026-11-11', 2);
const cancelled = request('cancelled', 'Annual', '2026-11-12', '2026-11-12', 1, 'Cancelled');
assert.equal(balance('Annual', '2026-10-28', [spanning, future, cancelled]).remaining, 6.13);
assert.equal(balance('Annual', '2026-11-30', [spanning, future, cancelled]).remaining, 7.8);
const irregular = request('fractional', 'Annual', '2026-10-29', '2026-11-03', 1.5);
assert.equal(balance('Annual', '2026-11-01', [irregular]).requiresReview, true);
assert.equal(balance('Annual', '2026-11-01', [irregular]).remaining, 10.13);
const fr2026 = request('fr26', 'Family Responsibility', '2026-11-10', '2026-11-10', 1);
const fr2027 = request('fr27', 'Family Responsibility', '2027-01-04', '2027-01-04', 1);
assert.equal(balance('Family Responsibility', '2026-12-31', [fr2026, fr2027]).remaining, 1);
assert.equal(balance('Family Responsibility', '2026-12-31', [fr2026, fr2027]).taken, 2);
assert.equal(balance('Family Responsibility', '2027-01-01', [fr2026, fr2027]).remaining, 2);
assert.equal(balance('Sick', '2026-11-01').entitled, 30);
assert.equal(balance('Sick', '2026-11-01').taken, 6);
const negative = [{ employeeId: 'e', type: 'Annual', entitled: 0, taken: 0, remaining: -1.25 }];
assert.equal(employeeAnnualLiabilityR(employee, negative), -250);
assert.equal(employeeAnnualLiabilityR({ ...employee, dailyCostR: null }, negative), null);
assert.equal(leaveLiabilityR([employee, { ...employee, id: 'missing', dailyCostR: null }], negative), -250);
for (const [days, rate, expected] of [[5.5, 428.15, 2354.83], [11.5, 428.15, 4923.73], [-6.75, 954.22, -6440.99], [26.5, 314.95, 8346.18]]) {
  assert.equal(employeeAnnualLiabilityR({ ...employee, dailyCostR: rate }, [{ ...negative[0], remaining: days }]), expected);
}
assert.equal(correctedEmployeeNo('Staff_Leave_Request', 'PkBns3v6d9pK'), '0225');
assert.equal(correctedEmployeeNo('Sick_Leave_Register', 'PkBns3v6d9pK'), undefined);
assert.equal(correctedEmployeeNoForStoredRequest('PkBZXccbSevl'), 'EMP0186');
assert.equal(isUnresolvedJonoCode('0001'), true);
assert.equal(isUnresolvedJonoCode('0250'), false);
console.log('November balance and ownership checks passed.');
