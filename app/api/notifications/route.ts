import { NextRequest, NextResponse } from "next/server";
import { markAllRead, readNotifications } from "@/lib/notifications";
import { authorizeApi, rejectCrossOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi(["admin", "cfo"]);
  if (auth.response) return auth.response;
  const list = await readNotifications();
  return NextResponse.json(list.slice().reverse());
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(["admin", "cfo"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const { action } = await req.json().catch(() => ({ action: null }));
  if (action === "mark_all_read") {
    await markAllRead();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
