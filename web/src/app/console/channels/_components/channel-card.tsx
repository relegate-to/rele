"use client";

// Channel grid card. Mirrors the skill-card layout: square animated-emoji
// tile on the left, copy on the right, status dot at the bottom. The whole
// card opens the editor dialog; the enabled switch stops propagation.

import { memo, useEffect, useState } from "react";
import Lottie from "lottie-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useEmojiColor } from "../../skills/_lib/emoji-color";
import { type ChannelState } from "../_lib/channels";

export const ChannelCard = memo(function ChannelCard({
  state,
  onOpen,
  onToggle,
}: {
  state: ChannelState;
  onOpen: () => void;
  onToggle: (next: boolean) => void;
}) {
  const { def, slice, enabled, configured } = state;
  const emoji = def.glyph;
  const emojiColor = useEmojiColor(emoji);
  const lottieUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${[...emoji].map((c) => c.codePointAt(0)?.toString(16)).filter(Boolean).join("_")}/lottie.json`;
  const [hasHoveredIcon, setHasHoveredIcon] = useState(false);
  const [animFailed, setAnimFailed] = useState(false);
  const [lottieData, setLottieData] = useState<object | null>(null);

  useEffect(() => {
    if (!hasHoveredIcon || lottieData || animFailed) return;
    let cancelled = false;
    fetch(lottieUrl)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setLottieData(d); })
      .catch(() => { if (!cancelled) setAnimFailed(true); });
    return () => { cancelled = true; };
  }, [hasHoveredIcon, lottieData, animFailed, lottieUrl]);

  let statusLabel: string;
  let dotClass: string;
  if (!slice) {
    statusLabel = "Available";
    dotClass = "bg-[var(--muted)]/40";
  } else if (!configured) {
    statusLabel = "Needs setup";
    dotClass = "bg-[var(--status-warning-text)]";
  } else if (!enabled) {
    statusLabel = "Disabled";
    dotClass = "bg-[var(--muted)]/60";
  } else {
    statusLabel = "Connected";
    dotClass = "bg-[var(--status-success-text)]";
  }

  return (
    <div
      onClick={onOpen}
      className="group relative flex h-28 flex-row items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 cursor-pointer transition-colors duration-150 hover:border-[var(--accent)]/40"
    >
      <div
        className="group/icon relative grid aspect-square h-full shrink-0 place-items-center rounded-md overflow-hidden"
        onMouseEnter={() => setHasHoveredIcon(true)}
        style={{
          background: emojiColor
            ? `linear-gradient(135deg, rgba(${emojiColor}, 0.7), rgba(${emojiColor}, 0.45))`
            : "var(--surface-hi)",
        }}
      >
        <span
          className={cn("block text-[2.5rem] leading-none pointer-events-none", lottieData && "group-hover/icon:opacity-0")}
          style={{
            fontFamily: "'Noto Color Emoji', sans-serif",
            userSelect: "none",
            lineHeight: 1,
            transform: "translateY(0.06em)",
            filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
          }}
        >
          {emoji}
        </span>
        {lottieData && (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 group-hover/icon:opacity-100"
            style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
          >
            <Lottie animationData={lottieData} loop autoplay className="size-[2.875rem]" />
          </div>
        )}
      </div>

      <div className="flex flex-1 min-w-0 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[var(--text)] leading-snug truncate group-hover:text-[var(--accent)] transition-colors">
            {def.label}
          </p>
          {slice && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mt-0.5">
              <Switch size="sm" checked={enabled} onCheckedChange={(v) => onToggle(!!v)} />
            </div>
          )}
        </div>
        <p className="mt-1 flex-1 text-[11px] text-[var(--text-dim)] leading-relaxed line-clamp-2">
          {def.tagline}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
          <span className={cn("size-1.5 rounded-full shrink-0", dotClass)} />
          {statusLabel}
        </div>
      </div>
    </div>
  );
});
