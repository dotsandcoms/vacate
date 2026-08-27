// Durable notifications stored in Supabase so Vercel instances and deploys
// share one consistent event history.
import { createAdminSupabaseClient } from "./supabase/server";
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
  at: string;
  type: NotificationType;
  title: string;
  body?: string;
  read: boolean;
}

interface NotificationRow {
  id: string;
  created_at: string;
  type: NotificationType;
  title: string;
  body: string | null;
}

export async function readNotifications(userId: string): Promise<AppNotification[]> {
  const admin = createAdminSupabaseClient();
  const { data: rows, error } = await admin
    .from("notifications")
    .select("id,created_at,type,title,body")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Unable to load notifications: ${error.message}`);

  const notifications = (rows ?? []) as NotificationRow[];
  if (notifications.length === 0) return [];

  const ids = notifications.map((row) => row.id);
  const { data: reads, error: readsError } = await admin
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in("notification_id", ids);
  if (readsError) throw new Error(`Unable to load notification state: ${readsError.message}`);
  const readIds = new Set((reads ?? []).map((row) => row.notification_id));

  return notifications.map((row) => ({
    id: row.id,
    at: row.created_at,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    read: readIds.has(row.id),
  }));
}

export async function addNotification(
  type: NotificationType,
  title: string,
  body?: string,
  sourceKey?: string
) {
  const admin = createAdminSupabaseClient();
  const record = {
    type,
    title: title.slice(0, 500),
    body: body?.slice(0, 2_000) ?? null,
    source_key: sourceKey?.slice(0, 500) ?? null,
  };
  const query = sourceKey
    ? admin.from("notifications").upsert(record, { onConflict: "source_key", ignoreDuplicates: true })
    : admin.from("notifications").insert(record);
  const { error } = await query;
  if (error) throw new Error(`Unable to create notification: ${error.message}`);
}

export async function markAllRead(userId: string) {
  const admin = createAdminSupabaseClient();
  const { data: notifications, error } = await admin
    .from("notifications")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Unable to load notifications: ${error.message}`);
  if (!notifications?.length) return;

  const readAt = new Date().toISOString();
  const { error: writeError } = await admin.from("notification_reads").upsert(
    notifications.map(({ id }) => ({ notification_id: id, user_id: userId, read_at: readAt })),
    { onConflict: "notification_id,user_id" }
  );
  if (writeError) throw new Error(`Unable to update notifications: ${writeError.message}`);
}

type Snapshot = Record<string, string>;
let detecting = false;

export async function detectSyncEvents(
  requests: LeaveRequest[],
  employees: Employee[],
  source = "kissflow-primary"
) {
  if (detecting) return;
  detecting = true;
  try {
    const admin = createAdminSupabaseClient();
    const { data: stored, error: snapshotError } = await admin
      .from("kissflow_sync_snapshots")
      .select("snapshot")
      .eq("source", source)
      .maybeSingle();
    if (snapshotError) throw new Error(`Unable to load Kissflow snapshot: ${snapshotError.message}`);

    const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? "Someone";
    const prev = stored?.snapshot as Snapshot | undefined;
    const next: Snapshot = {};
    for (const request of requests) next[request.id] = request.status;

    // Seed current history silently on the first durable run.
    if (prev) {
      const norm = (status: string | undefined) => status === "Pending Sync" ? "Approved" : status;
      for (const request of requests) {
        const before = norm(prev[request.id]);
        const current = norm(request.status);
        const range = humanRange(request.startDate, request.endDate);
        if (before === undefined) {
          await addNotification(
            "new_request",
            `New leave request from ${empName(request.employeeId)}`,
            `${request.type} · ${range} · ${request.days} day${request.days === 1 ? "" : "s"} — awaiting approval`,
            `${source}:${request.id}:new_request`
          );
        } else if (before !== current) {
          if (current === "Approved") {
            await addNotification(
              "approved",
              `${empName(request.employeeId)}'s leave approved${request.approvedBy ? ` by ${request.approvedBy}` : ""}`,
              `${request.type} · ${range} — ready for payroll export`,
              `${source}:${request.id}:approved`
            );
          } else if (current === "Rejected") {
            await addNotification(
              "rejected",
              `${empName(request.employeeId)}'s leave rejected${request.rejectedBy ? ` by ${request.rejectedBy}` : ""}`,
              request.rejectionReason ? `"${request.rejectionReason}" · ${request.type} · ${range}` : `${request.type} · ${range}`,
              `${source}:${request.id}:rejected`
            );
          } else if (current === "Cancelled") {
            await addNotification(
              "system",
              `${empName(request.employeeId)}'s leave withdrawn`,
              `${request.type} · ${range}`,
              `${source}:${request.id}:cancelled`
            );
          }
        }
      }
    }

    const { error: saveError } = await admin.from("kissflow_sync_snapshots").upsert({
      source,
      snapshot: next,
      updated_at: new Date().toISOString(),
    });
    if (saveError) throw new Error(`Unable to save Kissflow snapshot: ${saveError.message}`);
  } finally {
    detecting = false;
  }
}
