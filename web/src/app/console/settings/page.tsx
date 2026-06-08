"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon, CheckIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import {
  ACCENTS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  applyAccent,
  isAccentKey,
  type AccentKey,
} from "@/lib/accent";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentKey>(DEFAULT_ACCENT);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentKey(stored)) setAccent(stored);
  }, []);

  function selectAccent(key: AccentKey) {
    setAccent(key);
    localStorage.setItem(ACCENT_STORAGE_KEY, key);
    applyAccent(key, resolvedTheme === "dark");
  }

  const themeOptions: { key: string; label: string; icon: typeof SunIcon }[] = [
    { key: "light", label: "Light", icon: SunIcon },
    { key: "dark", label: "Dark", icon: MoonIcon },
    { key: "system", label: "Auto", icon: MonitorIcon },
  ];

  return (
    <div className="relative min-h-[100svh] bg-[var(--bg)] text-[var(--text)]">
      <div className="relative z-10 max-w-[680px] mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="space-y-12"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Customize the look and feel of your console.
            </p>
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--text)]">Theme</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Choose a light or dark interface, or follow your system.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ key, label, icon: Icon }) => {
                const active = mounted && theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hi)]"
                    }`}
                  >
                    <Icon
                      className={`size-5 ${active ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`}
                      strokeWidth={1.5}
                    />
                    <span className={`text-xs ${active ? "text-[var(--accent)] font-medium" : "text-[var(--text-dim)]"}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--text)]">Accent</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Pick the highlight color used across the interface.
              </p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {ACCENTS.map((def) => {
                const active = mounted && accent === def.key;
                return (
                  <button
                    key={def.key}
                    type="button"
                    onClick={() => selectAccent(def.key)}
                    title={def.label}
                    aria-label={def.label}
                    className={`relative aspect-square rounded-xl border transition-all ${
                      active
                        ? "border-[var(--text)] scale-105"
                        : "border-[var(--border)] hover:border-[var(--border-hi)]"
                    }`}
                    style={{ backgroundColor: def.swatch }}
                  >
                    {active && (
                      <CheckIcon
                        className="absolute inset-0 m-auto size-5 text-white drop-shadow-sm"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
