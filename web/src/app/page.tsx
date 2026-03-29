"use client";

import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { EASE } from "@/lib/theme";
import { useNavigate } from "@/components/ui/page-transition";
import { NoiseGrain, Vignette } from "@/components/ui/bg-effects";

const footerLinks: [string, string][] = [
  ["GitHub", "https://github.com/relegate-to/rele"],
  ["Studio", "https://relegate.to"],
  ["Contact", "mailto:sam@relegate.to"],
];

export default function RelePage() {
  const navigate = useNavigate();
  const { data } = authClient.useSession();
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
          By Relegate
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
          An AI agent that works out of the box.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.46 }}
          className="flex gap-3 items-center"
        >
          {isSignedIn ? (
            <button
              onClick={() => navigate("/console")}
              className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.08em] uppercase bg-[var(--accent)] text-white px-6 py-[0.65rem] rounded-lg border-none cursor-pointer hover:bg-[var(--accent-dim)] transition-colors"
            >
              Go to dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/sign-in")}
                className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.08em] uppercase bg-[var(--accent)] text-white px-6 py-[0.65rem] rounded-lg border-none cursor-pointer hover:bg-[var(--accent-dim)] transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate("/sign-up")}
                className="font-[var(--font-dm-mono),monospace] text-[0.72rem] tracking-[0.08em] uppercase border border-[var(--border)] text-[var(--text-dim)] px-6 py-[0.65rem] rounded-lg bg-transparent cursor-pointer hover:border-[var(--border-hi)] hover:text-[var(--text)] transition-colors"
              >
                Sign up
              </button>
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
          {footerLinks.map(([label, href]) => (
            <a key={label} href={href} className="text-[var(--muted)] no-underline hover:text-[var(--text-dim)] transition-colors">
              {label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
