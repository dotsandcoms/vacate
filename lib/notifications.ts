// Built-in notifications: events are detected by diffing each Kissflow sync
// against the previous snapshot, then stored on disk (swap for Supabase in
// production).
import { promises as fs } from "fs";
import path from "path";
import { Employee, LeaveRequest } from "./types";
import { humanRange } from "./holidays";

export type NotificationType =
  | "new_request"
  | "approved"
  | "rejected"
  | "exported"
  | "system";

export interface AppNotification {
  id: string;
  at: string; // ISO datetime
  type: NotificationType;
  title: string;
  body?: string;
  read: boolean;
}

const DIR = path.join(process.cwd(), ".vacate-data");
const NOTIF_FILE = path.join(DIR, "notifications.json");
const SNAPSHOT_FILE = path.join(DIR, "sync-snapshot.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function readNotifications(): Promise<AppNotification[]> {
  return readJson<AppNotification[]>(NOTIF_FILE, []);
}

export async function addNotification(
  type: NotificationType,
  title: string,
  body?: string
) {
  const list = await readNotifications();
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    type,
    title,
    body,
    read: false,
  });
  await writeJson(NOTIF_FILE, list.slice(-200)); // keep the last 200
}

export async function markAllRead() {
  const list = await readNotifications();
  await writeJson(
    NOTIF_FILE,
    list.map((n) => ({ ...n, read: true }))
  );
}

// ── Sync diffing ─────────────────────────────────────────────────────────

type Snapshot = Record<string, string>; // kissflow item id → status

let detecting = false; // guard against parallel page renders double-writing

export async function detectSyncEvents(
  requests: LeaveRequest[],
  employees: Employee[]
) {
  if (detecting) return;
  detecting = true;
  try {
    const empName = (id: string) =>
      employees.find((e) => e.id === id)?.name ?? "Someone";

    const prev = await readJson<Snapshot | null>(SNAPSHOT_FILE, null);
    const next: Snapshot = {};
    for (const r of requests) next[r.id] = r.status;

    // First run: seed the snapshot silently so we don't flood the bell
    // with historic items.
    if (prev === null) {
      await writeJson(SNAPSHOT_FILE, next);
      return;
    }

    // "Pending Sync" was renamed to "Approved" — treat them as the same
    // state so the rename doesn't fire duplicate notifications.
    const norm = (s: string | undefined) =>
      s === "Pending Sync" ? "Approved" : s;

    for (const r of requests) {
      const before = norm(prev[r.id]);
      const range = humanRange(r.startDate, r.endDate);
      if (before === undefined) {
        await addNotification(
          "new_request",
          `New leave request from ${empName(r.employeeId)}`,
          `${r.type} · ${range} · ${r.days} day${r.days === 1 ? "" : "s"} — awaiting approval`
        );
      } else if (before !== norm(r.status)) {
        if (r.status === "Approved" || r.status === "Pending Sync") {
          await addNotification(
            "approved",
            `${empName(r.employeeId)}'s leave approved${r.approvedBy ? ` by ${r.approvedBy}` : ""}`,
            `${r.type} · ${range} — ready for payroll export`
          );
        } else if (r.status === "Rejected") {
          await addNotification(
            "rejected",
            `${empName(r.employeeId)}'s leave rejected${r.rejectedBy ? ` by ${r.rejectedBy}` : ""}`,
            r.rejectionReason
              ? `"${r.rejectionReason}" · ${r.type} · ${range}`
              : `${r.type} · ${range}`
          );
        } else if (r.status === "Cancelled") {
          await addNotification(
            "system",
            `${empName(r.employeeId)}'s leave withdrawn`,
            `${r.type} · ${range}`
          );
        }
      }
    }
    await writeJson(SNAPSHOT_FILE, next);
  } finally {
    detecting = false;
  }
}
