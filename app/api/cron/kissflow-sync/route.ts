import { NextResponse } from "next/server";
import { getKissflowData, usingKissflow } from "@/lib/kissflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "CRON_SECRET is not configured" },
      { status: 401 }
    );
  }

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "CRON_SECRET does not match" },
      { status: 401 }
    );
  }

  if (!usingKissflow) {
    return NextResponse.json(
      { error: "Kissflow is not configured" },
      { status: 503 }
    );
  }

  try {
    const data = await getKissflowData();
    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      requests: data.requests.length,
      employees: data.employees.length,
    });
  } catch (error) {
    console.error("[vacate] Scheduled Kissflow sync failed", error);
    return NextResponse.json(
      { error: "Unable to sync Kissflow" },
      { status: 500 }
    );
  }
}
