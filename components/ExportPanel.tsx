"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Download, FileSpreadsheet, Search, Settings2 } from 'lucide-react';
import type { Employee, LeaveRequest } from '@/lib/types';
import { defaultPayrollOptions, payrollHeaders, payrollRow, type PayrollOptions } from '@/lib/payroll';

type Batch = { id: string; exportedAt: string; exportedBy: string; requestIds: string[]; totalDays: number; employeeCount: number; options?: PayrollOptions; fileContent?: string };
export default function ExportPanel({ employees, requests }: { employees: Employee[]; requests: LeaveRequest[] }) {
  const router = useRouter();
  const [options, setOptions] = useState(defaultPayrollOptions);
  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const loadHistory = async () => {
    const response = await fetch('/api/exports');
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load export history.');
    setBatches(body);
  };
  useEffect(() => { loadHistory().catch(e => setError(e.message)); }, []);
  const pending = requests.filter(r => r.status === 'Approved' && !batches.some(b => b.requestIds.includes(r.id)));
  const periodInvalid = Boolean(from && to && from > to);
  const inPeriod = pending.filter(r => (!from || r.startDate >= from) && (!to || r.startDate <= to));
  const rows = inPeriod.map(r => ({ request: r, employee: employees.find(e => e.id === r.employeeId), ...payrollRow(r, employees.find(e => e.id === r.employeeId), options, remarks[r.id] ?? r.kissflowId) }));
  const visible = rows.filter(row => `${row.employee?.name} ${row.fields[0]} ${row.request.kissflowId}`.toLowerCase().includes(q.toLowerCase()));
  const chosen = rows.filter(row => selected.includes(row.request.id));
  const issues = chosen.some(row => row.issues.length);
  const totalDays = Math.round(chosen.reduce((sum, row) => sum + row.request.days, 0) * 100) / 100;
  const updateOptions = (change: Partial<PayrollOptions>) => { setOptions({ ...options, ...change }); setConfirmed(false); };
  const download = (content: string, name: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportBatch = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestIds: chosen.map(row => row.request.id), options, remarks, confirmed }) });
      const batch = await response.json();
      if (!response.ok) throw new Error(batch.error || 'Export failed.');
      setBatches(current => [batch, ...current]); setSelected([]);
      download(batch.fileContent, `${batch.id}.csv`);
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const redownload = async (batch: Batch) => {
    setError('');
    try {
      const response = await fetch(`/api/exports?batch=${encodeURIComponent(batch.id)}`);
      if (!response.ok) throw new Error((await response.json()).error);
      download(await response.text(), `${batch.id}.csv`);
    } catch (e) { setError((e as Error).message); }
  };
  const fieldClass = "input-base mt-1.5 min-h-11 px-3 py-2.5 text-slate-800 ring-slate-200 sm:min-h-11";
  const validCount = rows.filter(row => !row.issues.length).length;
  const exportHint = periodInvalid ? 'Check your period dates.' : !chosen.length ? 'Select leave below to create your export.' : issues ? 'Fix the selected rows marked in red.' : !confirmed ? 'Confirm the file settings to download.' : 'Your selected leave is ready to export.';
  const delimiterLabel = options.delimiter === ',' ? 'Comma' : options.delimiter === ';' ? 'Semicolon' : 'Tab';

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="panel overflow-hidden" aria-labelledby="payroll-period">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="payroll-period" className="text-lg font-semibold tracking-tight text-ink-900">Choose leave to export</h2><p className="mt-1 text-sm text-slate-600">Choose a period, then select the approved leave below.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{pending.length} awaiting export</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
          <label className="text-sm font-medium text-slate-700">From<input type="date" className={fieldClass} value={from} disabled={busy} onChange={e => { setFrom(e.target.value); setSelected([]); }} /></label>
          <label className="text-sm font-medium text-slate-700">To<input type="date" className={fieldClass} value={to} disabled={busy} onChange={e => { setTo(e.target.value); setSelected([]); }} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">Find an employee<div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${fieldClass} pl-9`} placeholder="Name, employee code or reference" value={q} onChange={e => setQ(e.target.value)} /></div></label>
        </div>
        <p className="text-xs text-slate-500">Uses the leave start date. Leave that spans two periods is exported in full.</p>
        {periodInvalid && <p role="alert" className="text-sm text-red-700">Choose a To date on or after the From date.</p>}
        <details className="group rounded-xl border border-slate-200/80 bg-white/50">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
            <Settings2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium text-slate-700">File settings</span>
            <span className="min-w-0 flex-1 text-xs text-slate-500">{options.dateFormat} · {delimiterLabel} · {options.headers ? 'With headers' : 'No headers'} · {options.payOut === 'N' ? 'No override' : 'Override'}</span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-slate-200/80 p-4">
            <p className="text-sm text-slate-600">Match these settings to your payroll importer.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Date format<select disabled={busy} className={fieldClass} value={options.dateFormat} onChange={e => updateOptions({ dateFormat: e.target.value as PayrollOptions['dateFormat'] })}><option>dd/mm/yyyy</option><option>yyyy-mm-dd</option><option>mm/dd/yyyy</option></select></label>
              <label className="text-sm font-medium text-slate-700">Separate fields with<select disabled={busy} className={fieldClass} value={options.delimiter} onChange={e => updateOptions({ delimiter: e.target.value as PayrollOptions['delimiter'] })}><option value=",">Comma</option><option value=";">Semicolon</option><option value={'\t'}>Tab</option></select></label>
              <label className="text-sm font-medium text-slate-700">Pay Out<select disabled={busy} className={fieldClass} value={options.payOut} onChange={e => updateOptions({ payOut: e.target.value as 'N' | 'Y' })}><option value="N">N — Do not override</option><option value="Y">Y — Override</option></select></label>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input className="h-4 w-4 accent-brand-600" disabled={busy} type="checkbox" checked={options.headers} onChange={e => updateOptions({ headers: e.target.checked })} />Include column headings in the file</label>
            <p className="text-xs text-slate-500">Leave codes: Annual 0001 · Family Responsibility 0003 · Sick 0020.</p>
          </div>
        </details>
      </div>
      <div className="payroll-export-summary">
        <div className="payroll-export-totals">
          <dl className="payroll-export-metrics">
            <div><dt>Requests selected</dt><dd>{chosen.length}</dd></div>
            <div><dt>Leave days</dt><dd>{totalDays}</dd></div>
            <div><dt>Employees</dt><dd>{new Set(chosen.map(row => row.request.employeeId)).size}</dd></div>
          </dl>
          <p role="status" className={`payroll-export-hint ${issues || periodInvalid ? 'text-red-700' : 'text-slate-600'}`}>{exportHint}</p>
        </div>
        <div className="payroll-export-actions">
          <label className={`payroll-export-confirmation ${confirmed ? 'is-confirmed' : ''}`}><input disabled={busy} type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>File settings match payroll</span></label>
          <button className="payroll-export-download" disabled={busy || !confirmed || !chosen.length || issues || periodInvalid} onClick={exportBatch}><Download aria-hidden="true" />{busy ? 'Creating export…' : 'Download payroll file'}</button>
        </div>
      </div>
    </section>
    <section className="panel overflow-hidden" aria-labelledby="approved-leave">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 id="approved-leave" className="section-title">Approved leave</h2><p className="mt-0.5 text-xs text-slate-500">{visible.length} shown · {validCount} ready in this period</p></div>
        <div className="flex flex-wrap items-center gap-2"><button className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40" disabled={busy || !validCount || periodInvalid} onClick={() => setSelected(rows.filter(row => !row.issues.length).map(row => row.request.id))}><Check aria-hidden="true" className="h-4 w-4" />Select all ready</button><button className="min-h-10 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={busy || !selected.length} onClick={() => setSelected([])}>Clear</button></div>
      </div>
    <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50/70"><tr className="text-left text-xs font-medium text-slate-600"><th className="p-3">Select</th>{payrollHeaders.map(h => <th className="p-3 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(row => <tr key={row.request.id}>
      <td className="p-3"><input type="checkbox" className="h-4 w-4 accent-brand-600" aria-label={`Select ${row.employee?.name ?? row.request.kissflowId}`} disabled={busy} checked={selected.includes(row.request.id)} onChange={e => setSelected(current => e.target.checked ? [...current, row.request.id] : current.filter(id => id !== row.request.id))} /></td>
      <td className="p-3"><span className="font-medium">{row.fields[0] || 'Missing code'}</span><p className="text-xs text-slate-500">{row.employee?.name ?? 'Unknown employee'}{row.employee?.active === false ? ' · Departed' : ''}</p>{row.issues.length > 0 && <p className="mt-1 max-w-xs text-xs text-red-700">{row.issues.join(' ')}</p>}</td>
      <td className="p-3">{row.fields[1] || 'Unmapped'}<p className="text-xs text-slate-500">{row.request.type}</p></td>
      {row.fields.slice(2, 6).map((field, i) => <td key={i} className="p-3 whitespace-nowrap">{field}{i === 2 && to && row.request.endDate > to && <p className="text-xs text-amber-700">Crosses period end</p>}</td>)}
      <td className="p-3"><input aria-label={`Remarks for ${row.request.kissflowId}`} className="input-base w-48 px-3 py-2 ring-slate-200" disabled={busy} value={remarks[row.request.id] ?? row.request.kissflowId} onChange={e => setRemarks(current => ({ ...current, [row.request.id]: e.target.value }))} /><p className="text-xs text-slate-500">{Array.from(row.fields[6]).length}/30 characters</p></td>
    </tr>)}{!visible.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No approved leave in this view. Try changing the dates or search.</td></tr>}</tbody></table></div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">Selection covers the whole period, including rows hidden by search.</p>
    </section>
    <details className="group panel overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 sm:px-6 [&::-webkit-details-marker]:hidden"><span className="section-title">Previous exports <span className="ml-2 text-xs font-normal text-slate-500">{batches.length} batches</span></span><ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
<div className="overflow-x-auto border-t border-slate-100"><table className="min-w-full text-sm"><thead><tr className="text-left eyebrow">{['Batch / exported by', 'Exported', 'Requests', 'Days', 'File'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{batches.map(batch => <tr key={batch.id}><td className="p-3 max-w-xs break-all">{batch.id}<p className="text-xs text-slate-500">{batch.exportedBy}</p></td><td className="p-3 whitespace-nowrap">{new Date(batch.exportedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</td><td className="p-3">{batch.requestIds.length}</td><td className="p-3">{batch.totalDays}</td><td className="p-3">{batch.options ? <button className="text-brand-600 underline" onClick={() => redownload(batch)}>Download again</button> : 'Legacy file unavailable'}</td></tr>)}{!batches.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No saved export batches.</td></tr>}</tbody></table></div>
    </details>
    <details className="group px-1 text-sm">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden"><FileSpreadsheet aria-hidden="true" className="h-4 w-4" />How to import into payroll<ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-4 max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white/70 p-5 text-slate-600">
        <ol className="list-decimal space-y-2 pl-5"><li>Download your selected leave.</li><li>Import the original file into payroll.</li><li>Check that payroll’s accepted requests and days match your export totals.</li></ol>
        <p className="text-xs leading-relaxed">Download the same file again from Previous exports if needed. If payroll accepts only some rows, check which ones succeeded before retrying. Avoid saving the file in Excel, which can remove leading zeros.</p>
        <details className="payroll-field-guide">
          <summary>Payroll field limits</summary>
          <div className="payroll-field-table-wrap">
            <table className="payroll-field-table">
              <thead><tr><th scope="col">Field</th><th scope="col">Requirement</th></tr></thead>
              <tbody>
                <tr><th scope="row">Employee Code</th><td>Up to 8 characters</td></tr>
                <tr><th scope="row">Transaction Code</th><td>Up to 4 characters</td></tr>
                <tr><th scope="row">Pay Out</th><td><span className="payroll-field-code">Y</span> Override · <span className="payroll-field-code">N</span> Do not override</td></tr>
                <tr><th scope="row">Date From / Date To</th><td>Up to 10 characters each</td></tr>
                <tr><th scope="row">Days Taken</th><td>3 integer digits, 2 decimal places <span className="payroll-field-example">e.g. 12.50</span></td></tr>
                <tr><th scope="row">Remarks</th><td>Up to 30 characters</td></tr>
              </tbody>
            </table>
          </div>
          <p className="payroll-field-note">Files use UTF-8 and CRLF line endings. Outstanding leave for departed employees is included.</p>
        </details>
      </div>
    </details>
  </div>;
}
