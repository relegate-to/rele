import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, X } from "lucide-react";
import { prettyJson } from "@/lib/format";

interface JsonModalProps {
  data: string;
  onClose: () => void;
}

/**
 * Modal for viewing and copying JSON data
 * Used in dashboard to preview object structures
 */
export function JsonModal({ data, onClose }: JsonModalProps) {
  const [copied, setCopied] = useState(false);

  const formatted = useMemo(() => prettyJson(data), [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // Copy failed silently
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3 shrink-0">
            <span className="font-[var(--font-dm-mono),monospace] text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
              Object Preview
            </span>

            <div className="flex items-center gap-2">
              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="relative p-1.5 transition-all duration-150 hover:text-[var(--accent)] hover:border-[var(--accent)]/50 active:scale-90"
              >
                {copied ? (
                  <Check className="size-4 text-[var(--accent)]" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-1 hover:text-[var(--accent)] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[var(--bg)]/50">
            <pre className="text-[11px] leading-normal font-[var(--font-dm-mono)] text-[var(--text-dim)] whitespace-pre-wrap break-words">
              {formatted}
            </pre>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
