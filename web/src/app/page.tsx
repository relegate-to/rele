"use client";

import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { EASE } from "@/lib/theme";
import { useNavigate } from "@/components/ui/page-transition";
import { NoiseGrain, Vignette } from "@/components/ui/bg-effects";
import { Button } from "@/components/ui/button";
import { RocketIcon } from "lucide-react";
import { I18nProvider, useTranslation } from "./console/_context/i18n-context";

const footerLinks = [
  { key: "landing.footer.github", url: "https://github.com/relegate-to/rele" },
  { key: "landing.footer.studio", url: "https://relegate.to" },
  { key: "landing.footer.contact", url: "mailto:sam@relegate.to" },
];

function RelePageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isPending } = authClient.useSession();
  const isSignedIn = !!data?.user;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <NoiseGrain />
      <Vignette />

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="font-[var(--font-dm-mono),monospace] text-[0.65rem] text-[var(--accent)] tracking-[0.2em] uppercase mb-7"
        >
          {t("landing.by-relegate")}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.22 }}
          className="font-semibold text-[clamp(2.8rem,6vw,5.5rem)] leading-[1.08] tracking-[-0.03em] text-[var(--text)] mb-5 max-w-[700px]"
        >
          rele
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.34 }}
          className="text-[1.15rem] text-[var(--text-dim)] leading-[1.7] max-w-[420px] mx-auto mb-11"
        >
          {t("landing.tagline")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.46 }}
          className="flex gap-3 items-center"
        >
          {isPending ? (
            <div className="h-9 w-[120px] rounded-lg bg-[var(--border)] animate-pulse" />
          ) : isSignedIn ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/console")}
              className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.08em] uppercase px-5 gap-2 border-[var(--accent)] shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
            >
              <RocketIcon className="size-3.5" />
              {t("landing.go-to-console")}
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                onClick={() => navigate("/sign-in")}
                className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.08em] uppercase px-6 shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
              >
                {t("landing.sign-in")}
              </Button>
              {/*<Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/sign-up")}
                className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.08em] uppercase px-6"
              >
                {t("landing.sign-up")}
              </Button>*/}
            </>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] px-12 py-6 flex items-center justify-between flex-wrap gap-4">
        <span className="font-[var(--font-dm-mono),monospace] text-[0.62rem] text-[var(--muted)] tracking-[0.06em]">
          {"rele — "}
          <a href="https://relegate.to" className="text-[var(--accent)] no-underline hover:text-[var(--accent-dim)] transition-colors">
            relegate.to
          </a>
        </span>
        <div className="flex gap-8 font-[var(--font-dm-mono),monospace] text-[0.62rem] text-[var(--muted)] tracking-[0.06em]">
          {footerLinks.map(({ key, url }) => (
            <a key={key} href={url} className="text-[var(--muted)] no-underline hover:text-[var(--text-dim)] transition-colors">
              {t(key)}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default function RelePage() {
  return (
    <I18nProvider>
      <RelePageContent />
    </I18nProvider>
  );
}
