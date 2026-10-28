import { NextRequest, NextResponse } from "next/server";
import { getLeaveRequests } from "@/lib/data";
import { validateLeaveAdjustment } from "@/lib/leave-adjustments";
import { authorizeApi, rejectCrossOrigin } from "@/lib/security";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authorizeApi(["admin"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  let input;
  try {
    input = validateLeaveAdjustment(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid correction." }, { status: 400 });
  }

  try {
    const existing = (await getLeaveRequests({ allDates: true })).find(
      (row) => row.id === input.requestId && row.employeeId === input.employeeId
    );
    if (!existing) return NextResponse.json({ error: "Leave record not found. Refresh the page and try again." }, { status: 404 });
    if (existing.type === input.type && existing.startDate === input.startDate
        && existing.endDate === input.endDate && existing.days === input.days) {
      return NextResponse.json({ error: "Change the leave type, dates or days before saving." }, { status: 400 });
    }
    const { error } = await createAdminSupabaseClient().from("leave_request_adjustments").insert({
      employee_id: existing.employeeId,
      kissflow_id: existing.kissflowId,
      type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      days: input.days,
      reason: input.reason,
      previous_values: { type: existing.type, startDate: existing.startDate, endDate: existing.endDate, days: existing.days },
      adjusted_by: auth.user.id,
      adjusted_by_name: auth.user.name,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[vacate] Leave correction failed", error);
    return NextResponse.json({ error: "Unable to save the correction. Please try again." }, { status: 500 });
  }
}
