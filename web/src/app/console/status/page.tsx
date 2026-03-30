"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HealthPanel } from "../_components/health-panel";
import { useMachinesContext } from "../_context/machines-context";
import { EASE } from "@/lib/theme";

export default function StatusPage() {
  const { machines, loading } = useMachinesContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (machines.length === 0) {
      router.replace("/console/onboarding");
    }
  }, [machines, loading, router]);

  if (loading || machines.length === 0) return null;

  return (
    <div className="relative min-h-[calc(100svh-3rem)] bg-[var(--bg)] text-[var(--text)]">
      <div className="relative z-10 max-w-[820px] mx-auto px-8 py-16">
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
