"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", nextPath.startsWith("/") ? nextPath : "/");
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: false },
      });
      if (authError) throw authError;
      setSent(true);
    } catch {
      // Do not disclose whether an email exists in the access list.
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        <ShieldCheck className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="eyebrow text-brand-700">Secure management access</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">Welcome back</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Sign in to your live leave management workspace.
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200" role="status">
          <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1 leading-6 text-emerald-800">If this address has access, we sent a secure sign-in link. It expires automatically.</p>
        </div>
      ) : (
        <>
          <label htmlFor="email" className="mt-8 block text-sm font-medium text-ink-900">
            Work email address
          </label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-base py-3.5 pl-10 pr-3"
              placeholder="name@urbantaskforce.co.za"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary mt-5 py-3.5 active:scale-[0.96] sm:w-full sm:py-3.5">
            <span>{busy ? "Sending secure link…" : "Continue securely"}</span>
            {!busy && <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
          </button>
        </>
      )}
      <p className="mt-7 flex items-start gap-2 text-xs leading-5 text-slate-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>Authorised users only. Sessions are validated securely and access can be revoked immediately.</span>
      </p>
    </form>
  );
}
