"use client";

// Best-effort dominant-color extraction for an emoji glyph. Renders the emoji
// to a hidden 64x64 canvas, averages the opaque pixels, and caches the result
// so we render each emoji at most once. Returns null when the canvas isn't
// available (SSR, locked-down embeds) — callers fall back to a neutral color.

import { useEffect, useState } from "react";

const emojiColorCache = new Map<string, string>();
let _sharedCanvas: HTMLCanvasElement | null = null;
let _sharedCtx: CanvasRenderingContext2D | null = null;

function getEmojiCanvas(): CanvasRenderingContext2D | null {
  if (_sharedCtx) return _sharedCtx;
  if (typeof document === "undefined") return null;
  _sharedCanvas = document.createElement("canvas");
  _sharedCanvas.width = 64;
  _sharedCanvas.height = 64;
  _sharedCtx = _sharedCanvas.getContext("2d", { willReadFrequently: true });
  return _sharedCtx;
}

function getEmojiColor(emoji: string): string | null {
  if (emojiColorCache.has(emoji)) return emojiColorCache.get(emoji)!;
  const ctx = getEmojiCanvas();
  if (!ctx) return null;

  ctx.clearRect(0, 0, 64, 64);
  ctx.font = "56px 'Noto Color Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 32, 36);

  const { data } = ctx.getImageData(0, 0, 64, 64);
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  if (count === 0) return null;

  const color = `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`;
  emojiColorCache.set(emoji, color);
  return color;
}

export function useEmojiColor(emoji: string | null) {
  const [color, setColor] = useState<string | null>(() =>
    emoji ? emojiColorCache.get(emoji) ?? null : null,
  );
  useEffect(() => {
    if (!emoji) return;
    if (emojiColorCache.has(emoji)) {
      setColor(emojiColorCache.get(emoji)!);
      return;
    }
    const id = (window.requestIdleCallback ?? setTimeout)(() => setColor(getEmojiColor(emoji)));
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, [emoji]);
  return color;
}
