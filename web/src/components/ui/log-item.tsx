import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CodeIcon } from "lucide-react";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import { JsonModal } from "@/components/ui/json-modal";
import {
  extractJsonFromCodeBlock,
  isValidJson,
  formatTime,
} from "@/lib/format";
import { PROSE_CLASSES_COMPACT } from "@/lib/constants";

interface LogMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "system" | "tool";
  timestamp: number;
}

interface LogItemProps {
  msg: LogMessage;
  compact?: boolean;
}

/**
 * Renders a single log/message item with support for JSON preview and expansion
 * Used in dashboard and can be reused for other activity feeds
 */
export function LogItem({ msg, compact = false }: LogItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const jsonContent = useMemo(
    () => extractJsonFromCodeBlock(msg.content),
    [msg.content]
  );

  const isJson = useMemo(
    () => isValidJson(jsonContent),
    [jsonContent]
  );

  const lines = msg.content.split(/\r?\n/);
  const shouldTruncate = lines.length > 3 || msg.content.length > 350;

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-[var(--border)]/30 py-3 last:border-0">
        <div className="flex items-center justify-between gap-4">
          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {isJson ? (
              <button
                onClick={() => setShowJson(true)}
                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-hi)] text-[9px] font-bold uppercase tracking-tighter text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all cursor-pointer"
              >
                <CodeIcon className="size-2.5" /> JSON
              </button>
            ) : (
              <motion.div
                initial={false}
                animate={{ height: isExpanded ? "auto" : "1.5em" }}
                className={`${PROSE_CLASSES_COMPACT} overflow-hidden cursor-text`}
              >
                <MarkdownProse variant="compact">
                  {msg.content}
                </MarkdownProse>
              </motion.div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex shrink-0 items-center gap-3">
            {!isJson && shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[8px] font-bold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              >
                [{isExpanded ? " LESS " : " MORE "}]
              </button>
            )}
            <span className="font-[var(--font-dm-mono),monospace] text-[10px] text-[var(--muted)] opacity-50">
              {formatTime(msg.timestamp)}
            </span>
            <span
              className={`font-[var(--font-dm-mono),monospace] text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded border transition-colors ${
                msg.role === "user"
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-border)]"
                  : "bg-[var(--surface-hi)] text-[var(--muted)] border-[var(--border)]"
              }`}
            >
              {msg.role}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showJson && (
          <JsonModal
            data={jsonContent}
            onClose={() => setShowJson(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
