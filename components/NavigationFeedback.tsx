"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (`${next.pathname}${next.search}` === `${window.location.pathname}${window.location.search}`) {
        return;
      }
      setPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {pending ? "Loading the next page" : ""}
      </div>
      {pending && (
        <div aria-hidden="true">
          <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-brand-100">
            <span className="route-progress block h-full w-2/5 bg-brand-500 shadow-[0_0_10px_rgba(237,166,56,0.7)]" />
          </div>
          <div className="fixed right-4 top-4 z-[59] hidden items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-panel backdrop-blur-md sm:flex">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            Loading live data…
          </div>
        </div>
      )}
    </>
  );
}
