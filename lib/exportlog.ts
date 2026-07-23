// Persistent export batch log — the audit trail for payroll exports.
// Stored as JSON on disk next to the app (swap for Supabase in production).
// Once a request ID appears in a batch it is locked: it shows as
// "Exported" and can never be re-exported.
import { promises as fs } from "fs";
import path from "path";

export interface ExportBatch {
  id: string; // e.g. BATCH-2026-07-20-1
  exportedAt: string; // ISO datetime
  exportedBy: string;
  requestIds: string[];
  totalDays: number;
  employeeCount: number;
}

const FILE = path.join(process.cwd(), ".vacate-data", "export-log.json");

export async function readExportLog(): Promise<ExportBatch[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as ExportBatch[];
  } catch {
    return [];
  }
}

export async function exportedRequestIds(): Promise<Map<string, ExportBatch>> {
  const log = await readExportLog();
  const map = new Map<string, ExportBatch>();
  for (const batch of log) {
    for (const id of batch.requestIds) map.set(id, batch);
  }
  return map;
}

export async function appendExportBatch(
  requestIds: string[],
  totalDays: number,
  employeeCount: number,
  exportedBy = "Admin"
): Promise<ExportBatch> {
  const log = await readExportLog();
  const already = new Set(log.flatMap((b) => b.requestIds));
  const fresh = requestIds.filter((id) => !already.has(id));
  if (fresh.length === 0) {
    throw new Error("All requests in this batch have already been exported.");
  }
  const today = new Date().toISOString().slice(0, 10);
  const seq = log.filter((b) => b.id.includes(today)).length + 1;
  const batch: ExportBatch = {
    id: `BATCH-${today}-${seq}`,
    exportedAt: new Date().toISOString(),
    exportedBy,
    requestIds: fresh,
    totalDays,
    employeeCount,
  };
  log.push(batch);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(log, null, 2), "utf8");
  return batch;
}
