import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="panel max-w-md p-8 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-red-600" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Access unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your account is not active for this dashboard or does not have permission to open this area.
        </p>
        <Link href="/login" className="btn-primary mt-6">Return to sign in</Link>
      </div>
    </main>
  );
}

