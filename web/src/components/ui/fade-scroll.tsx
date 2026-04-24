"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FadeScroll({
  className,
  innerClassName,
  children,
  fadeHeight = "h-8",
  fadeFrom = "from-[var(--bg)]",
  pinToBottom = false,
}: {
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  fadeHeight?: string;
  fadeFrom?: string;
  pinToBottom?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const pinnedRef = useRef(true);

  const checkFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 8);
    setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }, []);

  const handleScroll = useCallback(() => {
    checkFades();
    if (pinToBottom) {
      const el = scrollRef.current;
      if (!el) return;
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }
  }, [pinToBottom, checkFades]);

  // Auto-scroll when content changes, only if pinned
  const prevScrollHeight = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = el.scrollHeight > prevScrollHeight.current;
    prevScrollHeight.current = el.scrollHeight;
    if (pinToBottom && pinnedRef.current && grew) {
      el.scrollTop = el.scrollHeight;
    }
    checkFades();
  });

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn("overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", innerClassName)}
      >
        {children}
      </div>
      <div className={cn("pointer-events-none absolute top-0 left-0 right-0 bg-gradient-to-b to-transparent transition-opacity duration-200 rounded-t-[inherit]", fadeFrom, fadeHeight, showTopFade ? "opacity-100" : "opacity-0")} />
      <div className={cn("pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t to-transparent transition-opacity duration-200 rounded-b-[inherit]", fadeFrom, fadeHeight, showBottomFade ? "opacity-100" : "opacity-0")} />
    </div>
  );
}
