"use client";

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import { ArrowUpIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import { ToolIcon } from "@/components/ui/tool-icon";

const PROSE_CLASSES = [
  "prose-chat text-sm leading-relaxed text-[var(--text)]",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3",
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3",
  "[&_li]:mb-1.5 [&_li]:leading-relaxed",
  "[&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2",
  "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-4 [&_h1:first-child]:mt-0",
  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2:first-child]:mt-0",
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2",
  "[&_code]:bg-[var(--surface-hi)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_code]:font-[var(--font-dm-mono),monospace]",
  "[&_pre]:bg-[var(--surface)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:mb-3 [&_pre]:overflow-x-auto",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs",
  "[&_hr]:border-[var(--border)] [&_hr]:my-4",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--accent)]/30 [&_blockquote]:pl-4 [&_blockquote]:text-[var(--text-dim)] [&_blockquote]:italic",
].join(" ");

function AnimatedText({ content }: { content: string }) {
  // Split into word/whitespace tokens. Words get a stable index key — React
  // keeps existing nodes alive (no re-animation) and mounts new ones fresh.
  const tokens = content.split(/(\s+)/);
  return (
    <>
      {tokens.map((token, i) =>
        /^\s+$/.test(token) ? (
          <span key={i}>{token}</span>
        ) : (
          <motion.span
            key={i}
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            {token}
          </motion.span>
        )
      )}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-[var(--muted)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function ChatPage() {
  const { machines, loading } = useMachinesContext();
  const { messages, connected, connecting, isThinking, error, connect, sendMessage } = useSandboxChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const machine = machines[0] ?? null;
  const isRunning = machine?.state === "started" || machine?.state === "running";

  // Redirect if no machine
  useEffect(() => {
    if (!loading && !machine) {
      router.replace("/console/dashboard");
    }
  }, [machine, loading, router]);

  // Auto-connect when machine is running (but not if there's an error)
  useEffect(() => {
    if (isRunning && !connected && !connecting && !error) {
      connect();
    }
  }, [isRunning, connected, connecting, error, connect]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (loading || !machine) return null;

  return (
    <div className="relative flex h-[100svh] flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Floating status pill */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2"
      >
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
          <span
            className={`size-1.5 rounded-full transition-colors duration-300 ${
              connected
                ? "bg-[var(--status-success)]"
                : connecting
                  ? "bg-[var(--status-warning)] animate-pulse"
                  : "bg-[var(--status-neutral)]"
            }`}
          />
          <span className="font-[var(--font-dm-mono),monospace] text-[11px] tracking-wide text-[var(--muted)]">
            {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
          </span>
          {!connected && !connecting && isRunning && (
            <button
              onClick={() => connect()}
              className="ml-0.5 font-[var(--font-dm-mono),monospace] text-[11px] text-[var(--accent)] hover:underline"
            >
              {error ? "Retry" : "Connect"}
            </button>
          )}
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {/* Empty state */}
          {messages.length === 0 && connected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
              className="flex flex-col items-center justify-center pt-[20vh]"
            >
              <h2 className="text-2xl font-semibold text-[var(--text)]">
                What can I help with?
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Send a message to start a conversation with your agent.
              </p>
            </motion.div>
          )}

          {/* Message list */}
          <div className="flex flex-col gap-5">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className={msg.role === "tool" ? "-my-2" : ""}
              >
                {msg.role === "user" ? (
                  /* User message — right-aligned pill */
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 shadow-sm">
                      <p className="font-[var(--font-dm-mono),monospace] text-sm leading-relaxed text-white whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : msg.role === "tool" ? (
                  /* Tool event — compact inline chip */
                  <div className="flex items-center">
                    <div
                      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-[var(--font-dm-mono),monospace] text-xs ${
                        msg.toolError
                          ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)]"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                    >
                      <ToolIcon name={msg.toolName ?? ""} isError={msg.toolError} />
                      <span className={msg.toolError ? "text-[var(--status-error-text)]" : "text-[var(--text)]"}>
                        {msg.toolName}
                      </span>
                      {msg.toolMeta && (
                        <>
                          <span className="text-[var(--border)]">·</span>
                          <span className="text-[var(--muted)] truncate max-w-[48ch]">{msg.toolMeta}</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Assistant message — left-aligned, clean */
                  <div>
                    <div className={PROSE_CLASSES}>
                      {msg.isStreaming ? (
                        <p><AnimatedText content={msg.content} /></p>
                      ) : (
                        <Markdown>{msg.content}</Markdown>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Typing indicator */}
            <AnimatePresence>
              {isThinking && connected && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="px-6 pb-5 pt-2">
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-auto w-full max-w-4xl overflow-hidden"
            >
              <div className="mb-2 rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error-border)] px-4 py-2.5">
                <span className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--status-error-text)]">
                  {error}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          className="mx-auto max-w-4xl"
        >
          <div
            className={`
              relative flex items-end gap-2 rounded-2xl border bg-[var(--surface)] p-2 pl-4
              shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_var(--border)]
              transition-shadow duration-200
              focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.1),0_0_0_1px_var(--accent)]
              ${!connected ? "opacity-60" : ""}
            `}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? "Message your agent..." : "Waiting for connection..."}
              disabled={!connected}
              rows={1}
              className="
                max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent py-1
                font-[var(--font-dm-mono),monospace] text-sm leading-relaxed text-[var(--text)]
                placeholder:text-[var(--muted)]
                focus:outline-none
                disabled:cursor-not-allowed
              "
            />
            <button
              onClick={handleSend}
              disabled={!connected || !input.trim()}
              className="
                flex size-8 shrink-0 items-center justify-center rounded-xl
                bg-[var(--accent)] text-white
                transition-all duration-150
                hover:bg-[var(--accent-dim)]
                disabled:opacity-30 disabled:hover:bg-[var(--accent)]
                active:scale-95
              "
            >
              <ArrowUpIcon className="size-4" strokeWidth={2.5} />
            </button>
          </div>
          <p className="mt-2 text-center font-[var(--font-dm-mono),monospace] text-[10px] tracking-wide text-[var(--muted)]">
            Press Enter to send, Shift+Enter for a new line
          </p>
        </motion.div>
      </div>
    </div>
  );
}
