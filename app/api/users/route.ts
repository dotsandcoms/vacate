import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { authorizeApi, rejectCrossOrigin } from "@/lib/security";
import type { AppRole } from "@/lib/auth";

const ROLES = new Set<AppRole>(["admin", "cfo", "department_manager"]);

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if (auth.response) return auth.response;

  const admin = createAdminSupabaseClient();
  const [{ data: authData, error: authError }, { data: profiles, error: profileError }] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("app_users").select("user_id,email,full_name,role,department,active,created_at"),
    ]);
  if (authError || profileError) {
    return NextResponse.json({ error: "Unable to load users" }, { status: 500 });
  }

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const users = authData.users.map((user) => {
    const profile = profilesById.get(user.id);
    return {
      id: user.id,
      email: user.email ?? profile?.email ?? "",
      name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
      role: profile?.role ?? null,
      department: profile?.department ?? null,
      active: profile?.active === true,
      invitedAt: user.invited_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      createdAt: profile?.created_at ?? user.created_at,
    };
  });
  return NextResponse.json(users.sort((a, b) => a.email.localeCompare(b.email)));
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi(["admin"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await request.json().catch(() => null);
  const email = cleanText(body?.email, 254).toLowerCase();
  const name = cleanText(body?.name, 120);
  const role = cleanText(body?.role, 40) as AppRole;
  const department = cleanText(body?.department, 120) || null;
  if (!validEmail(email) || !ROLES.has(role)) {
    return NextResponse.json({ error: "A valid email and role are required" }, { status: 400 });
  }
  if (role === "department_manager" && !department) {
    return NextResponse.json({ error: "Department managers require a department" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: existingList, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) return NextResponse.json({ error: "Unable to check user" }, { status: 500 });
  let user = existingList.users.find((candidate) => candidate.email?.toLowerCase() === email);

  if (!user) {
    const redirectTo = new URL("/auth/callback", request.nextUrl.origin).toString();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: name },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: "Unable to send invitation" }, { status: 400 });
    }
    user = data.user;
  }

  const { error: profileError } = await admin.from("app_users").upsert({
    user_id: user.id,
    email,
    full_name: name || null,
    role,
    department: role === "department_manager" ? department : null,
    active: true,
    invited_by: auth.user!.id,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    return NextResponse.json({ error: "Unable to save access profile" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userId: user.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi(["admin"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await request.json().catch(() => null);
  const userId = cleanText(body?.userId, 64);
  const email = cleanText(body?.email, 254).toLowerCase();
  const name = cleanText(body?.name, 120);
  const role = cleanText(body?.role, 40) as AppRole;
  const department = cleanText(body?.department, 120) || null;
  const active = body?.active;
  if (!userId || !validEmail(email) || !ROLES.has(role) || typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid access update" }, { status: 400 });
  }
  if (userId === auth.user!.id) {
    return NextResponse.json(
      { error: "You cannot change or disable your own access" },
      { status: 400 }
    );
  }
  if (role === "department_manager" && !department) {
    return NextResponse.json({ error: "Department managers require a department" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: target } = await admin
    .from("app_users")
    .select("role,active")
    .eq("user_id", userId)
    .maybeSingle();
  if (target?.role === "admin" && target.active && (!active || role !== "admin")) {
    const { count } = await admin
      .from("app_users")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "At least one active administrator is required" },
        { status: 400 }
      );
    }
  }
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
    email,
    user_metadata: { full_name: name },
  });
  if (authUpdateError) {
    return NextResponse.json({ error: "Unable to update the user's sign-in details" }, { status: 400 });
  }
  const { error } = await admin
    .from("app_users")
    .update({
      email,
      full_name: name || null,
      role,
      department: role === "department_manager" ? department : null,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Unable to update access" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeApi(["admin"]);
  if (auth.response) return auth.response;
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await request.json().catch(() => null);
  const userId = cleanText(body?.userId, 64);
  if (!userId) return NextResponse.json({ error: "A user is required" }, { status: 400 });
  if (userId === auth.user!.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: target, error: targetError } = await admin
    .from("app_users")
    .select("role,active")
    .eq("user_id", userId)
    .maybeSingle();
  if (targetError) return NextResponse.json({ error: "Unable to verify user access" }, { status: 500 });

  if (target?.role === "admin" && target.active) {
    const { count } = await admin
      .from("app_users")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "The final active administrator cannot be deleted" }, { status: 400 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: "Unable to delete user" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
