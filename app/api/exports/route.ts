import { NextRequest, NextResponse } from "next/server";
import { appendExportBatch, readExportLog } from "@/lib/exportlog";
import { addNotification } from "@/lib/notifications";
import { authorizeApi, rejectCrossOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi(["admin", "cfo"]);
  if (auth.response) return auth.response;
  const log = await readExportLog();
  return NextResponse.json(log.slice().reverse());
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(["admin", "cfo"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const { requestIds, totalDays, employeeCount } = await req.json();
    if (
      !Array.isArray(requestIds) ||
      requestIds.length === 0 ||
      requestIds.length > 10_000 ||
      requestIds.some((id) => typeof id !== "string" || id.length > 100)
    ) {
      return NextResponse.json({ error: "No request IDs" }, { status: 400 });
    }
    const safeTotalDays = Number.isFinite(Number(totalDays)) ? Number(totalDays) : 0;
    const safeEmployeeCount = Number.isInteger(Number(employeeCount)) ? Number(employeeCount) : 0;
    const batch = await appendExportBatch(requestIds, safeTotalDays, safeEmployeeCount);
    await addNotification(
      "exported",
      `Payroll batch ${batch.id} exported`,
      `${batch.requestIds.length} request${batch.requestIds.length === 1 ? "" : "s"} · ${batch.totalDays} days · ${batch.employeeCount} staff — locked against re-export`,
      `payroll-export:${batch.id}`
    );
    return NextResponse.json(batch);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
