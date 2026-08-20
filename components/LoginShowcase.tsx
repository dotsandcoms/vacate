"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react";

const slides = [
  {
    eyebrow: "One source of truth",
    title: "Leave data your leadership team can trust.",
    copy: "Live Kissflow records, clear approval status and reliable employee balances—without another spreadsheet.",
  },
  {
    eyebrow: "Built for decisive teams",
    title: "See what needs attention before it becomes a problem.",
    copy: "Give HR, finance and department leaders a shared view, with access carefully limited by role.",
  },
  {
    eyebrow: "From request to payroll",
    title: "A calmer, faster way to manage every leave cycle.",
    copy: "Move from live requests to payroll-ready exports with fewer manual checks and less admin effort.",
  },
];

export default function LoginShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[active];

  return (
    <section className="login-showcase" aria-label="UTF-Leave product overview">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />
        <div className="login-grid" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between gap-10 p-8 lg:p-10 xl:p-14">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-ink-900 shadow-lg shadow-black/10">
              UTF
            </div>
            <div>
              <p className="text-sm font-semibold">Urban Task Force</p>
              <p className="text-xs text-white/55">Leave intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-inset ring-white/10 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
            Live with Kissflow
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <div className="login-preview-window">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Leave overview</p>
                <p className="mt-1 text-sm font-semibold text-ink-900">Good morning, Finance</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-900">CF</div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 p-4 sm:gap-3 sm:p-5">
              <PreviewStat icon={Users} label="Employees" value="232" tone="brand" />
              <PreviewStat icon={Clock3} label="Awaiting" value="18" tone="violet" />
              <PreviewStat icon={CalendarDays} label="On leave" value="12" tone="emerald" />
            </div>
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-[1.25fr_.75fr] sm:px-5 sm:pb-5">
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-900">Approval flow</p>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="mt-5 flex h-20 items-end gap-2" aria-hidden="true">
                  {[42, 64, 50, 78, 58, 88, 72, 94, 68].map((height, index) => (
                    <span key={index} className="flex-1 rounded-t bg-brand-400/80" style={{ height: `${height}%`, opacity: 0.45 + index * 0.055 }} />
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[9px] font-medium uppercase tracking-wider text-slate-400">
                  <span>Submitted</span><span>Approved</span>
                </div>
              </div>
              <div className="rounded-xl bg-ink-900 p-4 text-white shadow-xl shadow-ink-900/15">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <p className="mt-6 text-2xl font-semibold tabular-nums">96%</p>
                <p className="mt-1 text-[11px] leading-4 text-white/55">requests processed within target</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl text-white" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">{slide.eyebrow}</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">{slide.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">{slide.copy}</p>
          <div className="mt-6 flex gap-2" aria-label={`Slide ${active + 1} of ${slides.length}`}>
            {slides.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                onClick={() => setActive(index)}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${index === active ? "w-8 bg-brand-400" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
                aria-label={`Show slide ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewStat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: "brand" | "violet" | "emerald" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-inset ring-slate-100 sm:p-4">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
      <p className="mt-3 text-lg font-semibold tabular-nums text-ink-900 sm:text-xl">{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-slate-400 sm:text-[10px]">{label}</p>
    </div>
  );
}
