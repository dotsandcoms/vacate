import { NextRequest, NextResponse } from "next/server";
import { appendExportBatch, readExportLog } from "@/lib/exportlog";
import { addNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const log = await readExportLog();
  return NextResponse.json(log.slice().reverse());
}

export async function POST(req: NextRequest) {
  try {
    const { requestIds, totalDays, employeeCount } = await req.json();
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: "No request IDs" }, { status: 400 });
    }
    const batch = await appendExportBatch(requestIds, totalDays ?? 0, employeeCount ?? 0);
    await addNotification(
      "exported",
      `Payroll batch ${batch.id} exported`,
      `${batch.requestIds.length} request${batch.requestIds.length === 1 ? "" : "s"} · ${batch.totalDays} days · ${batch.employeeCount} staff — locked against re-export`
    );
    return NextResponse.json(batch);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
