import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient, createServerSupabaseClient } from "./supabase/server";
import type { Employee, LeaveRequest } from "./types";

export type AppRole = "admin" | "cfo" | "department_manager";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  department: string | null;
  active: boolean;
  bootstrap: boolean;
}

const VALID_ROLES = new Set<AppRole>(["admin", "cfo", "department_manager"]);

function bootstrapEmails() {
  return new Set(
    (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const email = String(claims.email ?? "").trim().toLowerCase();
  if (!email) return null;

  const admin = createAdminSupabaseClient();
  const { data: profile, error: profileError } = await admin
    .from("app_users")
    .select("user_id,email,full_name,role,department,active")
    .eq("user_id", claims.sub)
    .maybeSingle();

  if (profileError && profileError.code !== "PGRST205" && profileError.code !== "42P01") {
    throw profileError;
  }

  if (profile && VALID_ROLES.has(profile.role as AppRole)) {
    return {
      id: profile.user_id,
      email: profile.email,
      name: profile.full_name?.trim() || profile.email,
      role: profile.role as AppRole,
      department: profile.department?.trim() || null,
      active: profile.active === true,
      bootstrap: false,
    };
  }

  if (bootstrapEmails().has(email)) {
    const bootstrapProfile = {
      user_id: String(claims.sub),
      email,
      full_name: String(claims.user_metadata?.full_name ?? email),
      role: "admin" as const,
      department: null,
      active: true,
      updated_at: new Date().toISOString(),
    };
    // Once the migration exists, materialise the allowlisted bootstrap admin
    // as a normal profile. The allowlist can then be removed safely.
    await admin.from("app_users").upsert(bootstrapProfile).then(() => undefined);
    return {
      id: String(claims.sub),
      email,
      name: bootstrapProfile.full_name,
      role: "admin",
      department: null,
      active: true,
      bootstrap: true,
    };
  }

  return null;
});

export async function requireUser(roles?: readonly AppRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.active) redirect("/unauthorized");
  if (roles && !roles.includes(user.role)) redirect("/unauthorized");
  return user;
}

export function canAccessPayroll(user: CurrentUser) {
  return user.role === "admin" || user.role === "cfo";
}

export function canManageUsers(user: CurrentUser) {
  return user.role === "admin";
}

export function scopeEmployees(user: CurrentUser, employees: Employee[]) {
  if (user.role !== "department_manager") return employees;
  if (!user.department) return [];
  return employees.filter(
    (employee) => employee.department.toLowerCase() === user.department!.toLowerCase()
  );
}

export function scopeRequests(
  user: CurrentUser,
  employees: Employee[],
  requests: LeaveRequest[]
) {
  const scopedEmployees = scopeEmployees(user, employees);
  const ids = new Set(scopedEmployees.map((employee) => employee.id));
  return {
    employees: scopedEmployees,
    requests: requests.filter((request) => ids.has(request.employeeId)),
  };
}
