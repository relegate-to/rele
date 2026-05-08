"use client";

// Best-effort dominant-color extraction for an emoji glyph. Renders the emoji
// to a hidden 64x64 canvas, averages the opaque pixels, and caches the result
// so we render each emoji at most once. Returns null when the canvas isn't
// available (SSR, locked-down embeds) — callers fall back to a neutral color.

import { useEffect, useState } from "react";

// sRGB ↔ OKLCH (perceptual) so we can shift hue and clamp chroma/lightness
// without the channel-skew artifacts of HSL or a linear-RGB saturation boost.
const srgbToLin = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const linToSrgb = (c: number) => {
  const x = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(x * 255)));
};
function rgbToOklch(r: number, g: number, b: number) {
  const lr = srgbToLin(r), lg = srgbToLin(g), lb = srgbToLin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.hypot(a, bb);
  const H = (Math.atan2(bb, a) * 180) / Math.PI;
  return { L, C, H: (H + 360) % 360 };
}
function oklchToRgb(L: number, C: number, H: number) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [linToSrgb(lr), linToSrgb(lg), linToSrgb(lb)] as const;
}

// Analogous-ish background tone: nudge hue, clamp chroma so it recedes,
// pin lightness into a band that reads well under the gradient's alpha.
const HUE_SHIFT = 25;          // degrees — analogous neighbor on the wheel
const CHROMA_MIN = 0.06;       // floor so grey emoji still get a tint
const CHROMA_MAX = 0.11;       // ceiling so saturated emoji don't scream
const LIGHTNESS_TARGET = 0.68; // perceptual L for the surface band

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

  // Convert the weighted average through OKLCH and reshape: nudge hue to an
  // analogous neighbor, clamp chroma into a "background-friendly" band, and
  // pin lightness so the gradient reads consistently across all emojis.
  const { C, H } = rgbToOklch(r / weightSum, g / weightSum, b / weightSum);
  const [outR, outG, outB] = oklchToRgb(
    LIGHTNESS_TARGET,
    Math.max(CHROMA_MIN, Math.min(CHROMA_MAX, C)),
    (H + HUE_SHIFT + 360) % 360,
  );

  const color = `${outR}, ${outG}, ${outB}`;
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
