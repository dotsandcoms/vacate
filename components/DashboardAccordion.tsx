"use client";

import { ChevronDown } from "lucide-react";
import { CSSProperties, ReactNode, useEffect, useState } from "react";

type DashboardAccordionProps = {
  id: string;
  title: string;
  description?: string;
  headerAside?: ReactNode;
  children: ReactNode;
  animationOrder?: number;
  contentClassName?: string;
  className?: string;
};

export default function DashboardAccordion({
  id,
  title,
  description,
  headerAside,
  children,
  animationOrder = 0,
  contentClassName = "px-4 pb-4 sm:px-5 sm:pb-5",
  className = "",
}: DashboardAccordionProps) {
  const [open, setOpen] = useState(true);
  const storageKey = `vacate:dashboard:${id}:open`;
  const headingId = `dashboard-${id}-heading`;
  const contentId = `dashboard-${id}-content`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === "true");
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // The accordion still works for this visit without persistence.
      }
      return next;
    });
  };

  return (
    <section
      className={`panel dashboard-block-enter overflow-hidden ${className}`}
      style={
        {
          "--dashboard-enter-delay": `${animationOrder * 70}ms`,
        } as CSSProperties
      }
    >
      <div className="flex min-h-14 items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 self-center">
          <h2 id={headingId} className="section-title">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerAside}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
            onClick={toggle}
            className="dashboard-toggle inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 ease-out hover:bg-slate-100/80 hover:text-ink-800"
          >
            <ChevronDown
              aria-hidden="true"
              className={`dashboard-chevron h-4 w-4 ${
                open ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div
        id={contentId}
        role="region"
        aria-labelledby={headingId}
        aria-hidden={!open}
        inert={!open}
        className={`dashboard-collapse grid ${
          open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={contentClassName}>{children}</div>
        </div>
      </div>
    </section>
  );
}
