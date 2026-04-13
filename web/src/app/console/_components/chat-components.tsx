"use client";

import { useEffect, useRef, useState, useCallback, memo, type KeyboardEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpIcon, CopyIcon, CheckIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";
import { ToolIcon } from "@/components/ui/tool-icon";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import { useTranslation } from "../_context/i18n-context";

export function AssistantMessage({ content, children }: { content: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group/msg relative">
      {children}
      <motion.button
        onClick={handleCopy}
        whileTap={{ scale: 0.78 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        className={`absolute -bottom-6 left-0 flex size-6 items-center justify-center rounded-md text-[var(--muted)] transition-colors duration-100 hover:text-[var(--text)] ${copied ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100"}`}
        aria-label={t("chat.copy-message")}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="check" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 700, damping: 18 }}>
              <CheckIcon className="size-3.5 text-[var(--accent)]" />
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 700, damping: 18 }}>
              <CopyIcon className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

export const MessageRow = memo(function MessageRow({ msg }: { msg: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease: EASE }}
      className={msg.role === "tool" ? "-my-2" : ""}
    >
      {msg.role === "user" ? (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5">
            <MarkdownProse variant="user">{msg.content}</MarkdownProse>
          </div>
        </div>
      ) : msg.role === "tool" ? (
        <div className="flex min-w-0 items-center">
          <div className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
            <ToolIcon name={msg.toolName ?? ""} isError={msg.toolError} />
            <span className="shrink-0">{msg.toolName}</span>
            {msg.toolMeta && (
              <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{msg.toolMeta}</span>
            )}
          </div>
        </div>
      ) : (
        <AssistantMessage content={msg.content}>
          <MarkdownProse isStreaming={msg.isStreaming}>
            {msg.content}
          </MarkdownProse>
        </AssistantMessage>
      )}
    </motion.div>
  );
});

export interface ChatInputProps {
  connected: boolean;
  onSend: (text: string) => void;
  compact?: boolean;
}

export function ChatInput({ connected, onSend, compact = false }: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxHeight = compact ? 120 : 200;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [maxHeight]);

  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    },
    [handleSend]
  );

  const innerBox = (
    <div className={`relative flex items-end gap-2 rounded-2xl border bg-[var(--surface)]/80 backdrop-blur-sm p-2 pl-4 shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_var(--border)] transition-all duration-200 focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.12),0_0_0_1px_var(--accent)] ${!connected ? "opacity-60" : ""}`}>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={connected ? t("chat.message-placeholder") : t("chat.waiting-connection")}
        disabled={!connected}
        rows={1}
        className={`${compact ? "max-h-[120px]" : "max-h-[200px]"} min-h-[28px] flex-1 resize-none bg-transparent py-1 font-[var(--font-dm-mono),monospace] text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none disabled:cursor-not-allowed`}
      />
      <button
        onClick={handleSend}
        disabled={!connected || !input.trim()}
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all duration-150 hover:bg-[var(--accent-dim)] disabled:opacity-30 disabled:hover:bg-[var(--accent)] active:scale-95"
      >
        <ArrowUpIcon className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );

  if (compact) {
    return (
      <div className="px-3 pb-3 pt-1.5">
        {innerBox}
      </div>
    );
  }

  return (
    <div className="px-6 pb-5 pt-2">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
        className="mx-auto max-w-4xl"
      >
        {innerBox}
        <p className="mt-2 text-center font-[var(--font-dm-mono),monospace] text-[10px] tracking-wide text-[var(--muted)]">
          {t("chat.send-help")}
        </p>
      </motion.div>
    </div>
  );
}
