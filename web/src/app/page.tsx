"use client";

import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { EASE } from "@/lib/theme";
import { useNavigate } from "@/components/ui/page-transition";
import { NoiseGrain, Vignette } from "@/components/ui/bg-effects";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, RocketIcon } from "lucide-react";
import { useTranslation } from "./console/_context/i18n-context";

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
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          className="font-semibold text-[clamp(3.2rem,8vw,6rem)] leading-[0.95] tracking-[-0.04em] text-[var(--text)] mb-6"
        >
          rele
        </motion.h1>

        <motion.span
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.32 }}
          className="block h-px w-12 bg-[var(--accent)] mb-7 origin-center"
          aria-hidden
        />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.38 }}
          className="text-[1.05rem] sm:text-[1.15rem] text-[var(--text-dim)] leading-[1.65] max-w-[440px] mx-auto mb-10"
        >
          {t("landing.tagline")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
        >
          {isPending ? (
            <div className="h-9 w-[120px] rounded-lg bg-[var(--border)]/60 animate-pulse" />
          ) : isSignedIn ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/console")}
              className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.1em] uppercase px-5 gap-2 border-[var(--accent)] text-[var(--text)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text)]"
            >
              <RocketIcon className="size-3.5" />
              {t("landing.go-to-console")}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => navigate("/sign-in")}
              className="group font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.1em] uppercase px-6 gap-2 hover:bg-[color-mix(in_srgb,var(--primary)_88%,white)]"
            >
              {t("landing.sign-in")}
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
        className="relative z-10 border-t border-[var(--border)] px-8 sm:px-12 py-6 flex items-center justify-between flex-wrap gap-4 font-[var(--font-dm-mono),monospace] text-[0.62rem] text-[var(--text-dim)] tracking-[0.1em]"
      >
        <span>
          {"rele · "}
          <a
            href="https://relegate.to"
            className="text-[var(--accent)] no-underline hover:text-[var(--accent-dim)] transition-colors"
          >
            relegate.to
          </a>
        </span>
        <div className="flex gap-7">
          {footerLinks.map(({ key, url }) => (
            <a
              key={key}
              href={url}
              className="hover:text-[var(--text)] transition-colors"
            >
              {t(key)}
            </a>
          ))}
        </div>
      </motion.footer>
    </div>
  );
}

export default function RelePage() {
  return <RelePageContent />;
}
