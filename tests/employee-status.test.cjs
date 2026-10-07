const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/employee-status.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
function load(result, env = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NODE_ENV: 'production' }) {
  const calls = [];
  const exports = {};
  const context = { exports, process: { env, cwd: () => '/var/task' }, require(name) {
    if (name === 'fs') return { promises: new Proxy({}, { get() { throw new Error('Unexpected filesystem access'); } }) };
    if (name === 'path') return require('node:path');
    if (name === './utils') return {};
    if (name === './supabase/server') return { createAdminSupabaseClient: () => ({ from(table) { calls.push(table); return { update(value) { calls.push(value); return { eq(field, value) { calls.push([field, value]); return { select: async () => result }; } }; } }; } }) };
    throw new Error(name);
  }};
  vm.runInNewContext(source, context);
  return { api: exports, calls };
}
(async () => {
  const id = '12345678-1234-1234-1234-123456789012';
  const success = load({data:[{id}],error:null});
  await success.api.setEmployeeActive({id,active:false});
  assert.equal(success.calls[1].active,false);
  assert.equal(success.calls[2][0],'id');
  await success.api.setEmployeeActive({id:'kissflow-id',employeeNo:'000123',active:true});
  assert.equal(success.calls[5][0],'employee_no');
  const employees = [{id,active:false}];
  assert.equal(await success.api.applyEmployeeStatus(employees),employees);
  await assert.rejects(load({data:[],error:null}).api.setEmployeeActive({id,active:false}),/not found/);
  await assert.rejects(load({data:null,error:{message:'Database unavailable'}}).api.setEmployeeActive({id,active:false}),/Database unavailable/);
  await assert.rejects(load({}, {NODE_ENV:'production'}).api.setEmployeeActive({id,active:false}),/not configured/);
  console.log('Employee status checks passed: database writes, matching, failures and no production filesystem access.');
})();
