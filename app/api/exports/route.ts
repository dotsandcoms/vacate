import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { addNotification } from '@/lib/notifications';
import { readExportLog, savePayrollBatch, type ExportBatch } from '@/lib/exportlog';
import { getKissflowRegister } from '@/lib/data';
import { payrollRow, payrollFile, validOptions } from '@/lib/payroll';
import { authorizeApi, rejectCrossOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const auth = await authorizeApi(['admin', 'cfo']);
  if (auth.response) return auth.response;
  try {
    const log = await readExportLog();
    const id = req.nextUrl.searchParams.get('batch');
    if (id) {
      const batch = log.find(b => b.id === id);
      if (!batch?.fileContent) return NextResponse.json({ error: 'Saved file unavailable for this batch.' }, { status: 404 });
      return new NextResponse(batch.fileContent, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${batch.id}.csv"`, 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(log.slice().reverse().map(({ fileContent, ...batch }) => batch));
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const auth = await authorizeApi(['admin', 'cfo']);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const { requestIds, options, remarks, confirmed } = await req.json();
    if (!confirmed || !validOptions(options) || !Array.isArray(requestIds) || !requestIds.length || requestIds.length > 10000 || requestIds.some(id => typeof id !== 'string' || !id || id.length > 100) || new Set(requestIds).size !== requestIds.length) throw new Error('Select requests and confirm the payroll file settings.');
    const { employees, requests } = await getKissflowRegister({ allDates: true });
    const selected = requestIds.map(id => {
      const request = requests.find(r => r.id === id && r.status === 'Approved');
      if (!request) throw new Error('A selected request is no longer eligible. Refresh the page.');
      return request;
    });
    const rows = selected.map(r => {
      const remark = remarks?.[r.id] ?? r.kissflowId;
      if (typeof remark !== 'string') throw new Error('Invalid Remarks.');
      const row = payrollRow(r, employees.find(e => e.id === r.employeeId), options, remark);
      if (row.issues.length) throw new Error(`${r.kissflowId}: ${row.issues.join(' ')}`);
      return row.fields;
    });
    const batch: ExportBatch = {
      id: `BATCH-${new Date().toISOString().slice(0, 10)}-${randomUUID()}`,
      exportedAt: new Date().toISOString(), exportedBy: auth.user!.email,
      requestIds, totalDays: Math.round(selected.reduce((sum, r) => sum + r.days, 0) * 100) / 100,
      employeeCount: new Set(selected.map(r => r.employeeId)).size,
      fileContent: payrollFile(rows, options), options,
    };
    await savePayrollBatch(batch);
    // A notification failure must not turn a saved export into a failed response.
    await addNotification('exported', `Payroll batch ${batch.id} exported`, `${batch.requestIds.length} requests · ${batch.totalDays} days · awaiting payroll import reconciliation`, `payroll-export:${batch.id}`).catch(() => {});
    return NextResponse.json(batch);
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
}
