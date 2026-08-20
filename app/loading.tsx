export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200/80" />
          <div className="h-4 w-64 max-w-[70vw] animate-pulse rounded bg-slate-200/60" />
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-xs font-medium text-slate-500 shadow-panel sm:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          Loading live Kissflow data…
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border-b border-slate-100 px-5 py-4 sm:border-b-0">
              <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-200/80" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-200/60" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="panel panel-pad h-80 animate-pulse bg-white/50" />
        <div className="space-y-4">
          <div className="panel panel-pad h-36 animate-pulse bg-white/50" />
          <div className="panel panel-pad h-40 animate-pulse bg-white/50" />
        </div>
      </div>

      <p className="text-center text-sm text-slate-500 sm:hidden">
        Loading live Kissflow data…
      </p>
    </div>
  );
}
