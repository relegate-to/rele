"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { useChat } from "../_context/chat-context";
import { useSessions } from "../_context/sessions-context";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { MessageRow, ChatInput } from "./chat-components";
import { useTranslation } from "../_context/i18n-context";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";

const SPRING = { type: "spring", stiffness: 380, damping: 40 } as const;

export function FloatingChat({ contextPrompt, sessionName }: { contextPrompt?: string; sessionName?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { messages: mainMessages, connected, isThinking: mainIsThinking, sendMessage, sendToSession, observeSession, getSessionMessages, getSessionThinking, currentModel, setModel } = useChat();
  const { createSession } = useSessions();
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [sessionIsThinking, setSessionIsThinking] = useState(false);
  const creatingRef = useRef(false);

  // Create the hidden session on mount if sessionName is provided.
  useEffect(() => {
    if (!sessionName || sessionKey || creatingRef.current || !connected) return;
    creatingRef.current = true;
    createSession(sessionName, false).then((key) => setSessionKey(key));
  }, [sessionName, sessionKey, connected, createSession]);

  // Observe session messages.
  useEffect(() => {
    if (!sessionKey) return;
    setSessionMessages(getSessionMessages(sessionKey));
    setSessionIsThinking(getSessionThinking(sessionKey));
    return observeSession(sessionKey, () => {
      setSessionMessages(getSessionMessages(sessionKey));
      setSessionIsThinking(getSessionThinking(sessionKey));
    });
  }, [sessionKey, observeSession, getSessionMessages, getSessionThinking]);

  const messages = sessionKey ? sessionMessages : mainMessages;
  const isThinking = sessionKey ? sessionIsThinking : mainIsThinking;

  const send = useCallback(
    (content: string) => {
      if (sessionKey) {
        sendToSession(sessionKey, content, contextPrompt);
      } else {
        sendMessage(content, contextPrompt);
      }
    },
    [sessionKey, sendToSession, sendMessage, contextPrompt],
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || !pinnedToBottomRef.current) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const scroll = () => {
      const target = el.scrollHeight - el.clientHeight;
      const diff = target - el.scrollTop;
      if (Math.abs(diff) < 2) { el.scrollTop = target; rafRef.current = null; }
      else { el.scrollTop += diff * 0.16; rafRef.current = requestAnimationFrame(scroll); }
    };
    rafRef.current = requestAnimationFrame(scroll);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isThinking, scrollToBottom]);

  useEffect(() => {
    if (!open) return;
    pinnedToBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom());
  }, [open, scrollToBottom]);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.div
        initial={{ width: 48, height: 48, borderRadius: 16 }}
        animate={{ width: open ? 360 : 48, height: open ? 520 : 48, borderRadius: open ? 20 : 16 }}
        transition={SPRING}
        className="overflow-hidden shadow-[0_8px_40px_rgba(79,70,229,0.22)]"
        style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dim))", padding: 1 }}
      >
        <motion.div
          animate={{ borderRadius: open ? 19 : 15 }}
          transition={SPRING}
          className="relative w-full h-full bg-[var(--surface)] overflow-hidden"
        >
          {/* ── Button icon — always rendered, fades out when open ── */}
          <button
            onClick={() => setOpen(true)}
            aria-label={t("chat.open")}
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
            style={{ opacity: open ? 0 : 1, pointerEvents: open ? "none" : "auto" }}
          >
            <span className="text-xl leading-none text-[var(--accent)]">✦</span>
          </button>

          {/* ── Panel — always rendered, fades in when open ── */}
          <div
            className="flex flex-col h-full transition-opacity duration-150"
            style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none text-[var(--accent)]">✦</span>
                <span className="text-sm font-semibold text-[var(--text)]">{t("chat.title")}</span>
                <span className={`size-1.5 rounded-full ${connected ? "bg-green-500" : "bg-[var(--muted)]"}`} />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-md p-1 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                aria-label={t("chat.minimize")}
              >
                <ChevronDownIcon className="size-4" />
              </button>
            </div>

            {/* Message list */}
            <div ref={scrollContainerRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
              <AnimatePresence>
                {messages.length === 0 && (
                  <motion.div
                    key="greeting"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center pointer-events-none"
                  >
                    <div className="size-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center mb-1">
                      <span className="text-base">✦</span>
                    </div>
                    <h2 className="text-sm font-semibold text-[var(--text)]">{t("chat.help-prompt")}</h2>
                    <p className="text-xs text-[var(--muted)] max-w-[220px] leading-relaxed">
                      {t("chat.start-conversation")}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="px-4 py-4 flex flex-col gap-5">
                {messages.map((msg) => (
                  <MessageRow key={msg.id} msg={msg} />
                ))}
                <motion.div animate={{ opacity: isThinking && connected ? 1 : 0 }}>
                  <TypingIndicator />
                </motion.div>
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border)] shrink-0">
              <ChatInput connected={connected} onSend={send} compact model={currentModel} onModelChange={setModel} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
