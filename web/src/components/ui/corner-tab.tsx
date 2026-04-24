"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, ComponentProps } from "react";

interface CornerTabProps extends ComponentProps<"button"> {
  children: ReactNode;
}

export function CornerTab({ children, className, ...props }: CornerTabProps) {
  return (
    <button
      className={cn(
        "absolute bottom-0 right-0 rounded-tl-lg rounded-br-lg bg-[var(--surface)] border-t border-l border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors truncate max-w-[200px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
