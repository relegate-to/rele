export type AccentKey = "indigo" | "violet" | "blue" | "emerald" | "yellow" | "orange" | "rose";

export type AccentDef = {
  key: AccentKey;
  label: string;
  light: { accent: string; dim: string; subtle: string };
  dark: { accent: string; dim: string; subtle: string };
  swatch: string;
};

// Dark-mode accents use saturated mid-tones, not pastels — several components
// (chat send button, onboarding CTA, etc.) layer white text on solid
// bg-[var(--accent)], which fails on pastels.
export const ACCENTS: AccentDef[] = [
  {
    key: "indigo",
    label: "Indigo",
    light: { accent: "#4f46e5", dim: "#4338ca", subtle: "#e0e7ff" },
    dark: { accent: "#6366f1", dim: "#4f46e5", subtle: "rgba(99, 102, 241, 0.15)" },
    swatch: "#6366f1",
  },
  {
    key: "violet",
    label: "Violet",
    light: { accent: "#7c3aed", dim: "#6d28d9", subtle: "#ede9fe" },
    dark: { accent: "#8b5cf6", dim: "#7c3aed", subtle: "rgba(139, 92, 246, 0.15)" },
    swatch: "#8b5cf6",
  },
  {
    key: "blue",
    label: "Blue",
    light: { accent: "#2563eb", dim: "#1d4ed8", subtle: "#dbeafe" },
    dark: { accent: "#3b82f6", dim: "#2563eb", subtle: "rgba(59, 130, 246, 0.15)" },
    swatch: "#3b82f6",
  },
  {
    key: "emerald",
    label: "Emerald",
    light: { accent: "#059669", dim: "#047857", subtle: "#d1fae5" },
    dark: { accent: "#10b981", dim: "#059669", subtle: "rgba(16, 185, 129, 0.15)" },
    swatch: "#10b981",
  },
  {
    key: "yellow",
    label: "Yellow",
    light: { accent: "#eab308", dim: "#ca8a04", subtle: "#fef9c3" },
    dark: { accent: "#eab308", dim: "#ca8a04", subtle: "rgba(234, 179, 8, 0.18)" },
    swatch: "#eab308",
  },
  {
    key: "orange",
    label: "Orange",
    light: { accent: "#ea580c", dim: "#c2410c", subtle: "#ffedd5" },
    dark: { accent: "#c2410c", dim: "#9a3412", subtle: "rgba(194, 65, 12, 0.18)" },
    swatch: "#ea580c",
  },
  {
    key: "rose",
    label: "Rose",
    light: { accent: "#e11d48", dim: "#be123c", subtle: "#ffe4e6" },
    dark: { accent: "#f43f5e", dim: "#e11d48", subtle: "rgba(244, 63, 94, 0.15)" },
    swatch: "#f43f5e",
  },
];

export const ACCENT_STORAGE_KEY = "rele-accent";
export const DEFAULT_ACCENT: AccentKey = "indigo";

export function isAccentKey(value: unknown): value is AccentKey {
  return typeof value === "string" && ACCENTS.some((a) => a.key === value);
}

export function applyAccent(key: AccentKey, isDark: boolean) {
  const def = ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];
  const palette = isDark ? def.dark : def.light;
  const root = document.documentElement;
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--accent-dim", palette.dim);
  root.style.setProperty("--accent-subtle", palette.subtle);
  root.style.setProperty("--primary", palette.accent);
  root.style.setProperty("--ring", palette.accent);
  root.style.setProperty("--sidebar-primary", palette.accent);
  root.style.setProperty("--sidebar-ring", palette.accent);
}
