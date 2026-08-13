import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { setEmployeeActive } from "@/lib/employee-status";

export const dynamic = "force-dynamic";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, employeeNo, active } = await req.json();
    if (!id || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "id and active (boolean) are required" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const canSyncSupabase = Boolean(url && key);
    const uuidLike = isUuid(id);
    const hasEmployeeNo = Boolean(employeeNo && employeeNo !== "—");

    if (canSyncSupabase && (uuidLike || hasEmployeeNo)) {
      const sb = createClient(url!, key!, {
        global: { fetch: (u, opts) => fetch(u, { ...opts, cache: "no-store" }) },
      });

      if (uuidLike) {
        const { error } = await sb
          .from("employees")
          .update({ active })
          .eq("id", id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      } else {
        const { error } = await sb
          .from("employees")
          .update({ active })
          .eq("employee_no", employeeNo);
        // PGRST116 = no matching row (Kissflow-only staff) — local overlay is enough.
        if (error && error.code !== "PGRST116") {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
    }

    await setEmployeeActive({ id, employeeNo, active });
    return NextResponse.json({ id, employeeNo, active });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
