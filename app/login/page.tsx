import LoginForm from "@/components/LoginForm";
import LoginShowcase from "@/components/LoginShowcase";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(420px,0.82fr)_minmax(580px,1.18fr)]">
      <section className="flex min-h-dvh items-center justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-xs font-bold text-white shadow-panel">UTF</div>
            <div>
              <p className="text-sm font-semibold text-ink-900">Urban Task Force</p>
              <p className="text-xs text-slate-400">Leave intelligence</p>
            </div>
          </div>
          <LoginForm nextPath={params.next} />
          <div className="mt-10 flex items-center justify-between text-[11px] text-slate-400">
            <span>© {new Date().getFullYear()} Urban Task Force</span>
            <span>Protected access</span>
          </div>
        </div>
      </section>
      <LoginShowcase />
    </main>
  );
}
