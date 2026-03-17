"use client";

import { NoiseGrain, Vignette } from "@/components/bg-effects";
import UserPill from "@/components/user-pill";
import { motion } from "framer-motion";
import { HealthPanel } from "./components/health-panel";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-[var(--font-crimson-pro),serif] font-light">
      <NoiseGrain />
      <Vignette />

      <div className="fixed top-5 right-6 z-10">
        <UserPill />
      </div>

      <div className="relative z-10 max-w-[520px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <HealthPanel />
        </motion.div>
      </div>
    </div>
  );
}
