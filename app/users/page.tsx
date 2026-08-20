import UserAccessManager from "@/components/UserAccessManager";
import { requireUser } from "@/lib/auth";

export default async function UsersPage() {
  const user = await requireUser(["admin"]);
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Security administration</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">User access</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Invite authorised users, assign least-privilege roles and revoke access immediately.
        </p>
      </header>
      <UserAccessManager currentUserId={user.id} />
    </div>
  );
}

