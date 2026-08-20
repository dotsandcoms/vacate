"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="inline-flex min-h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-slate-500 transition-[background-color,color,scale] duration-150 ease-out hover:bg-white/80 hover:text-ink-900 active:scale-[0.96]"
    >
      <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      Sign out
    </button>
  );
}

