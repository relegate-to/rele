"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, applyAccent, isAccentKey } from "@/lib/accent";

export function AccentApplier() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    const key = isAccentKey(stored) ? stored : DEFAULT_ACCENT;
    applyAccent(key, resolvedTheme === "dark");
  }, [resolvedTheme]);

  return null;
}
