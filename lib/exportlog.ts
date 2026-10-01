// Persistent export batch log — the audit trail for payroll exports.
// New batches and exact file contents are stored durably in Supabase.
// The legacy JSON log remains read-only for previous batch locks.
// Once a request ID appears in a batch it is locked: it shows as
// "Exported" and can never be re-exported.
import { promises as fs } from "fs";
import path from "path";
import { createAdminSupabaseClient } from "./supabase/server";
import type { PayrollOptions } from "./payroll";

export interface ExportBatch {
  id: string; // e.g. BATCH-2026-07-20-1
  exportedAt: string; // ISO datetime
  exportedBy: string;
  requestIds: string[];
  totalDays: number;
  employeeCount: number;
  fileContent?: string;
  options?: PayrollOptions;
}

const FILE = path.join(process.cwd(), ".vacate-data", "export-log.json");

async function legacyLog(): Promise<ExportBatch[]> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function readExportLog(): Promise<ExportBatch[]> {
  const legacy = await legacyLog();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return legacy;
  const { data, error } = await createAdminSupabaseClient().from("payroll_export_batches").select("payload").order("created_at");
  if (error) throw new Error("Payroll storage unavailable. Apply the payroll_exports migration before exporting.");
  return [...legacy, ...(data ?? []).map(row => row.payload as ExportBatch)];
}

export async function savePayrollBatch(batch: ExportBatch) {
  const already = await exportedRequestIds();
  if (batch.requestIds.some(id => already.has(id))) throw new Error("A selected request has already been exported. Refresh the page.");
  const { error } = await createAdminSupabaseClient().rpc("save_payroll_export", { batch });
  if (error) throw new Error(error.code === "23505" ? "A selected request was exported by another user. Refresh the page." : "Could not save payroll batch. Check the payroll storage migration.");
}

export async function exportedRequestIds(): Promise<Map<string, ExportBatch>> {
  const log = await readExportLog();
  const map = new Map<string, ExportBatch>();
  for (const batch of log) {
    for (const id of batch.requestIds) map.set(id, batch);
  }
  return map;
}
