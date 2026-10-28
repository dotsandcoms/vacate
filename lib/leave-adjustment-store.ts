import { createAdminSupabaseClient } from "./supabase/server";
import { overlayLeaveAdjustments, type StoredLeaveAdjustment } from "./leave-adjustments";
import type { LeaveRequest } from "./types";

export async function applyLeaveAdjustments(requests: LeaveRequest[]): Promise<LeaveRequest[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || requests.length === 0) return requests;
  const admin = createAdminSupabaseClient();
  const adjustments: StoredLeaveAdjustment[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from("leave_request_adjustments")
      .select("employee_id,kissflow_id,type,start_date,end_date,days,reason,adjusted_by_name,created_at,previous_values")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Leave corrections could not be loaded. Check the manual_leave_adjustments migration.");
    adjustments.push(...(data ?? []) as StoredLeaveAdjustment[]);
    if (!data || data.length < 1000) break;
  }
  return overlayLeaveAdjustments(requests, adjustments);
}
