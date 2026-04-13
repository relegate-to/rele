"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import en from "@/i18n/en";
import ja from "@/i18n/ja";

// Available locales
export const LOCALES = ["en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

type Translations = Record<string, string>;

const translationMap: Record<Locale, Translations> = { en, ja };

// Context shape
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("locale") as Locale;
  if (saved && LOCALES.includes(saved)) return saved;
  const lang = navigator.language.toLowerCase().split("-")[0];
  return LOCALES.includes(lang as Locale) ? (lang as Locale) : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectBrowserLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>): string => {
      let text = translationMap[locale]?.[key] ?? translationMap.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, v);
        }
      }
      return text;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

/** Convenience alias — returns { t, locale, setLocale } */
export function useTranslation() {
  return useI18n();
}
