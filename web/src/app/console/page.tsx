"use client";

import { motion } from "framer-motion";
import { HealthPanel } from "./_components/health-panel";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100svh-3rem)] bg-[var(--bg)] text-[var(--text)] font-[var(--font-crimson-pro),serif] font-light">

      <div className="relative z-10 max-w-[520px] mx-auto px-8 py-16">
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
