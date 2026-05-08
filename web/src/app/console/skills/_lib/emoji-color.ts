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
  // Saturation-weighted average: each opaque pixel contributes proportional
  // to (max-min)/max, so vivid pixels dominate over near-grays. Without this
  // the result trends toward muddy mid-tones because emojis carry a lot of
  // anti-aliased gray on outlines.
  let r = 0, g = 0, b = 0, weightSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    // Add 0.05 floor so grayscale emojis (skull, gear) still produce a color.
    const w = max === 0 ? 0.05 : (max - min) / max + 0.05;
    r += pr * w;
    g += pg * w;
    b += pb * w;
    weightSum += w;
  }
  if (weightSum === 0) return null;

  // Boost saturation on the result: pull each channel away from the mean.
  let avgR = r / weightSum;
  let avgG = g / weightSum;
  let avgB = b / weightSum;
  const mean = (avgR + avgG + avgB) / 3;
  const SATURATION_BOOST = 1.45;
  avgR = Math.max(0, Math.min(255, mean + (avgR - mean) * SATURATION_BOOST));
  avgG = Math.max(0, Math.min(255, mean + (avgG - mean) * SATURATION_BOOST));
  avgB = Math.max(0, Math.min(255, mean + (avgB - mean) * SATURATION_BOOST));

  const color = `${Math.round(avgR)}, ${Math.round(avgG)}, ${Math.round(avgB)}`;
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
