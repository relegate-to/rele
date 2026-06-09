"use client";

// Reusable emoji tile used by SkillCard and the install alert. Renders the
// emoji glyph over a gradient derived from the emoji's dominant color, with
// an optional Lottie hover animation.

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { cn } from "@/lib/utils";
import { useEmojiColor } from "../_lib/emoji-color";

const TEXT_STROKE: React.CSSProperties = {
  filter:
    "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
};

export function SkillIcon({
  emoji,
  size = 40,
  animate = false,
  className,
}: {
  emoji: string;
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  const color = useEmojiColor(emoji);
  const lottieUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${[...emoji]
    .map((c) => c.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join("_")}/lottie.json`;
  const [data, setData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!animate || data || failed) return;
    let cancelled = false;
    fetch(lottieUrl)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [animate, data, failed, lottieUrl]);

  return (
    <div
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-md", className)}
      style={{
        width: size,
        height: size,
        background: color
          ? `linear-gradient(135deg, rgba(${color}, 0.7), rgba(${color}, 0.45))`
          : "var(--surface-hi)",
      }}
    >
      <span
        className={cn("block pointer-events-none leading-none", animate && data && "opacity-0")}
        style={{
          fontFamily: "'Noto Color Emoji', sans-serif",
          userSelect: "none",
          fontSize: size * 0.62,
          lineHeight: 1,
          transform: "translateY(0.06em)",
          ...TEXT_STROKE,
        }}
      >
        {emoji}
      </span>
      {animate && data && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" style={TEXT_STROKE}>
          <Lottie animationData={data} loop autoplay style={{ width: size * 0.72, height: size * 0.72 }} />
        </div>
      )}
    </div>
  );
}
