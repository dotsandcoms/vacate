import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, type AppRole } from "./auth";

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  return origin === expected;
}

export async function authorizeApi(roles?: readonly AppRole[]) {
  const user = await getCurrentUser();
  if (!user || !user.active) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, response: null };
}

export function rejectCrossOrigin(request: NextRequest) {
  return isSameOrigin(request)
    ? null
    : NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
}

