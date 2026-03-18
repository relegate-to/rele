"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageAnimate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Force a reflow to restart the animation each time the pathname changes.
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "console-page-enter 0.25s cubic-bezier(0.22, 1, 0.36, 1) both";
  }, [pathname]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}
