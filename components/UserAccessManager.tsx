"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Pencil, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import type { AppRole } from "@/lib/auth";

interface AccessUser {
  id: string;
  email: string;
  name: string;
  role: AppRole | null;
  department: string | null;
  active: boolean;
  invitedAt: string | null;
  lastSignInAt: string | null;
}

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  cfo: "CFO / Finance",
  department_manager: "Department manager",
};

export default function UserAccessManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("department_manager");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccessUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/users", { cache: "no-store" });
    if (response.ok) setUsers(await response.json());
    else setError("Unable to load user access");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    setMessage(null);
    const data = new FormData(form);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          name: data.get("name"),
          role,
          department: data.get("department"),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setError(body.error ?? "Unable to grant access");
      else {
        setMessage("Access granted and invitation sent where required.");
        form.reset();
        setRole("department_manager");
        await load();
      }
    } catch {
      setError("Unable to grant access. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (user: AccessUser, changes: Partial<AccessUser>) => {
    setError(null);
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: changes.email ?? user.email,
        name: changes.name ?? user.name,
        role: changes.role ?? user.role,
        department: changes.department ?? user.department,
        active: changes.active ?? user.active,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Unable to update access");
      return false;
    }
    await load();
    return true;
  };

  const beginEdit = (user: AccessUser) => {
    setError(null);
    setMessage(null);
    setEditingId(user.id);
    setDraft({ ...user });
  };

  const saveEdit = async (user: AccessUser) => {
    if (!draft) return;
    const saved = await update(user, { ...draft, role: draft.role ?? "department_manager" });
    if (!saved) return;
    setEditingId(null);
    setDraft(null);
    setMessage("User details updated.");
  };

  const deleteUser = async (user: AccessUser) => {
    if (!window.confirm(`Permanently delete ${user.name || user.email}? They will need a new invitation to regain access.`)) return;
    setError(null);
    setMessage(null);
    const response = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error ?? "Unable to delete user");
    else {
      setMessage("User permanently deleted.");
      await load();
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={invite} className="panel panel-pad grid gap-4 lg:grid-cols-[1.1fr_1.2fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="access-name" className="text-sm font-medium text-ink-900">Name</label>
          <input id="access-name" name="name" className="input-base mt-1.5 px-3 py-2" maxLength={120} />
        </div>
        <div>
          <label htmlFor="access-email" className="text-sm font-medium text-ink-900">Work email</label>
          <input id="access-email" name="email" type="email" required autoComplete="email" className="input-base mt-1.5 px-3 py-2" maxLength={254} />
        </div>
        <div>
          <label htmlFor="access-role" className="text-sm font-medium text-ink-900">Access role</label>
          <select id="access-role" name="role" value={role} onChange={(event) => setRole(event.target.value as AppRole)} className="input-base mt-1.5 px-3 py-2">
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="access-department" className="text-sm font-medium text-ink-900">Department</label>
          <input id="access-department" name="department" required={role === "department_manager"} disabled={role !== "department_manager"} className="input-base mt-1.5 px-3 py-2 disabled:opacity-40" maxLength={120} />
        </div>
        <button type="submit" disabled={busy} className="btn-primary active:scale-[0.96]">
          <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {busy ? "Granting…" : "Grant access"}
        </button>
      </form>

      <div className="min-h-6" role="status" aria-live="polite">
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>

      <div className="panel overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead><tr className="text-left eyebrow"><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Last sign-in</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/60">
                <td className="min-w-56 px-4 py-3">{editingId === user.id && draft ? <div className="space-y-2"><input aria-label="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="input-base px-2.5 py-1.5" maxLength={120} /><input aria-label="Email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="input-base px-2.5 py-1.5" maxLength={254} /></div> : <><p className="font-medium text-ink-900">{user.name || user.email}</p><p className="text-xs text-slate-400">{user.email}</p></>}</td>
                <td className="px-4 py-3">
                  <select value={(editingId === user.id && draft ? draft.role : user.role) ?? "department_manager"} disabled={editingId !== user.id || user.id === currentUserId} onChange={(event) => draft && setDraft({ ...draft, role: event.target.value as AppRole, department: event.target.value === "department_manager" ? draft.department : null })} className="rounded-lg bg-white px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-200 disabled:opacity-50">
                    {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </td>
                <td className="min-w-44 px-4 py-3 text-slate-500">{editingId === user.id && draft && draft.role === "department_manager" ? <input aria-label="Department" required value={draft.department ?? ""} onChange={(event) => setDraft({ ...draft, department: event.target.value })} className="input-base px-2.5 py-1.5" maxLength={120} /> : user.department ?? "All departments"}</td>
                <td className="px-4 py-3 text-slate-500">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "Never"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">{editingId === user.id ? <><button type="button" onClick={() => saveEdit(user)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 active:scale-[0.96]" aria-label="Save user"><Check className="h-4 w-4" /></button><button type="button" onClick={() => { setEditingId(null); setDraft(null); }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 active:scale-[0.96]" aria-label="Cancel editing"><X className="h-4 w-4" /></button></> : <><button type="button" disabled={user.id === currentUserId} onClick={() => update(user, { active: !user.active })} className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-[scale,background-color,color] duration-150 active:scale-[0.96] disabled:opacity-50 ${user.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {user.active ? "Active" : "Revoked"}
                  </button><button type="button" disabled={user.id === currentUserId} onClick={() => beginEdit(user)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Edit ${user.name || user.email}`}><Pencil className="h-4 w-4" /></button><button type="button" disabled={user.id === currentUserId} onClick={() => deleteUser(user)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30" aria-label={`Delete ${user.name || user.email}`}><Trash2 className="h-4 w-4" /></button></>}</div>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No authorised users yet.</td></tr>}
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading access list…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
