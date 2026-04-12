import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  icon: LucideIcon;
}

export function ComingSoon({ title, icon: Icon }: ComingSoonProps) {
  return (
    <div className="min-h-[100svh] bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
      <div className="flex flex-col items-center text-center gap-6 px-8 max-w-sm">
        {/* Icon in a subtle bordered box */}
        <div className="relative">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/10 blur-xl scale-150" />
          <div className="relative flex size-16 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--surface-hi)]">
            <Icon className="size-7 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title + message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[var(--text)]">{title}</h1>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            This page is being worked on and will be ready in{" "}
            <span className="text-[var(--text-dim)] font-medium">1.0</span>.
          </p>
        </div>

        {/* Version badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-1">
          <span className="size-1.5 rounded-full bg-[var(--accent)]/60 animate-pulse" />
          <span className="text-xs font-medium text-[var(--accent)]/80 tracking-wide">
            Coming in 1.0
          </span>
        </div>
      </div>
    </div>
  );
}
