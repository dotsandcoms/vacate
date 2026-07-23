import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
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
    .select("id")
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

  return NextResponse.json({ ok: true });
}
