import { NextRequest, NextResponse } from "next/server";
import { markAllRead, readNotifications } from "@/lib/notifications";
import { authorizeApi, rejectCrossOrigin } from "@/lib/security";
import { getKissflowData, usingKissflow } from "@/lib/kissflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi(["admin", "cfo"]);
  if (auth.response) return auth.response;
  try {
    // The bell polls this route every 30 seconds. Reconcile through the shared
    // 60-second Kissflow cache so status changes arrive without page navigation
    // and without creating an API request per connected browser.
    if (usingKissflow) {
      await getKissflowData();
    }
    return NextResponse.json(await readNotifications(auth.user!.id));
  } catch (error) {
    console.error("[vacate] Unable to read notifications", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(["admin", "cfo"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const { action } = await req.json().catch(() => ({ action: null }));
  if (action === "mark_all_read") {
    try {
      await markAllRead(auth.user!.id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[vacate] Unable to mark notifications read", error);
      return NextResponse.json({ error: "Unable to update notifications" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
