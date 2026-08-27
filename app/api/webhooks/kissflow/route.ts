import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { addNotification } from "@/lib/notifications";

/**
 * Kissflow → Vacate webhook.
 *
 * Configure in Kissflow: Process → Integrations → Webhook on the
 * "Approved" step, POST JSON to https://<your-app>.vercel.app/api/webhooks/kissflow
 * with header  X-Webhook-Secret: <KISSFLOW_WEBHOOK_SECRET>
 *
 * Expected payload (map Kissflow fields accordingly):
 * {
 *   "requestId": "KF-2026-0110",
 *   "employeeNo": "EMP004",
 *   "leaveType": "Annual",
 *   "startDate": "2026-08-01",
 *   "endDate": "2026-08-05",
 *   "days": 5,
 *   "approvedBy": "Jane Manager",
 *   "approvedAt": "2026-07-17T10:00:00Z",
 *   "notes": "optional"
 * }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.KISSFLOW_WEBHOOK_SECRET;
  if (!secret || secret === "change-me") {
    console.error("[vacate] Kissflow webhook secret is not configured securely");
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  }
  const supplied = req.headers.get("x-webhook-secret") ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 262_144) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: any;
  try {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > 262_144) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = ["requestId", "employeeNo", "leaveType", "startDate", "endDate", "days"];
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === "");
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing fields: ${missing.join(", ")}` },
      { status: 422 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Mock mode — accept and log so the flow can be tested end-to-end.
    console.log("[vacate] Webhook received (mock mode):", payload);
    return NextResponse.json({ ok: true, mode: "mock" });
  }

  const sb = createClient(url, key, {
    global: { fetch: (u, opts) => fetch(u, { ...opts, cache: "no-store" }) },
  });

  // Resolve employee by employee number
  const { data: emp, error: empErr } = await sb
    .from("employees")
    .select("id,name")
    .eq("employee_no", payload.employeeNo)
    .single();
  if (empErr || !emp) {
    return NextResponse.json(
      { error: `Unknown employee: ${payload.employeeNo}` },
      { status: 422 }
    );
  }

  // Idempotent upsert on the Kissflow request ID — retries won't duplicate.
  const { error } = await sb.from("leave_requests").upsert(
    {
      kissflow_id: payload.requestId,
      employee_id: emp.id,
      type: payload.leaveType,
      start_date: payload.startDate,
      end_date: payload.endDate,
      days: payload.days,
      status: "Pending Sync",
      approved_by: payload.approvedBy ?? null,
      approved_at: payload.approvedAt ?? new Date().toISOString(),
      notes: payload.notes ?? null,
    },
    { onConflict: "kissflow_id" }
  );

  if (error) {
    console.error("[vacate] Webhook upsert failed:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  try {
    await addNotification(
      "approved",
      `${emp.name}'s leave approved${payload.approvedBy ? ` by ${String(payload.approvedBy).slice(0, 120)}` : ""}`,
      `${String(payload.leaveType).slice(0, 80)} · ${String(payload.startDate).slice(0, 10)} to ${String(payload.endDate).slice(0, 10)} — ready for payroll export`,
      `kissflow:${process.env.KISSFLOW_PROCESS_ID ?? "primary"}:${String(payload.requestId).slice(0, 200)}:approved`
    );
  } catch (notificationError) {
    console.error("[vacate] Webhook notification failed:", notificationError);
    return NextResponse.json({ error: "Notification persistence failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
