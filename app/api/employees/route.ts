import { NextRequest, NextResponse } from "next/server";
import { setEmployeeActive } from "@/lib/employee-status";
import { authorizeApi, rejectCrossOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(["admin"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const { id, employeeNo, active } = await req.json();
    if (typeof id !== "string" || !id || id.length > 100 || (employeeNo !== undefined && (typeof employeeNo !== "string" || employeeNo.length > 100)) || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "id and active (boolean) are required" },
        { status: 400 }
      );
    }

    await setEmployeeActive({ id, employeeNo, active });
    return NextResponse.json({ id, employeeNo, active });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
