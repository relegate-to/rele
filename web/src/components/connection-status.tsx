import { motion } from "framer-motion";
import { EASE } from "@/lib/theme";

interface ConnectionStatusProps {
  connected: boolean;
  connecting?: boolean;
  label?: string;
}

/**
 * Connection status badge with animated indicator
 * Shows "Connected", "Connecting...", or "Disconnected" with appropriate visual state
 */
export function ConnectionStatus({
  connected,
  connecting = false,
  label,
}: ConnectionStatusProps) {
  const displayLabel = label || (connected ? "Connected" : connecting ? "Connecting..." : "Disconnected");

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1.5 shadow-sm backdrop-blur-sm"
    >
      <span
        className={`size-1.5 rounded-full ${
          connected
            ? "bg-[var(--status-success)]"
            : connecting
            ? "bg-[var(--status-warning)] animate-pulse"
            : "bg-[var(--status-neutral)]"
        }`}
      />
      <span className="font-[var(--font-dm-mono),monospace] text-[11px] text-[var(--muted)]">
        {displayLabel}
      </span>
    </motion.div>
  );
}
