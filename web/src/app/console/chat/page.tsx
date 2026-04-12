"use client";

import { useEffect, useRef, useState, useCallback, memo, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpIcon, CopyIcon, CheckIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";
import { ToolIcon } from "@/components/ui/tool-icon";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { ConnectionStatus } from "@/components/ui/connection-status";

function AssistantMessage({ content, children }: { content: string; children: ReactNode }) {
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
        aria-label="Copy message"
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

const MessageRow = memo(function MessageRow({ msg }: { msg: ChatMessage }) {
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
        <div className="flex items-center">
          <div className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
            <ToolIcon name={msg.toolName ?? ""} isError={msg.toolError} />
            <span>{msg.toolName}</span>
            {msg.toolMeta && (
              <span className="text-[var(--muted)] truncate max-w-[300px]">{msg.toolMeta}</span>
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

function ChatInput({ connected, onSend }: { connected: boolean; onSend: (text: string) => void }) {
 const [input, setInput] = useState("");
 const textareaRef = useRef<HTMLTextAreaElement>(null);

 const resizeTextarea = useCallback(() => {
  const el = textareaRef.current;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
 }, []);

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

 return (
  <div className="px-6 pb-5 pt-2">
   <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
    className="mx-auto max-w-4xl"
   >
    <div className={`relative flex items-end gap-2 rounded-2xl border bg-[var(--surface)]/80 backdrop-blur-sm p-2 pl-4 shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_var(--border)] transition-all duration-200 focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.12),0_0_0_1px_var(--accent)] ${!connected ? "opacity-60" : ""}`}>
     <textarea
      ref={textareaRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={connected ? "Message your agent..." : "Waiting for connection..."}
      disabled={!connected}
      rows={1}
      className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent py-1 font-[var(--font-dm-mono),monospace] text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none disabled:cursor-not-allowed"
     />
     <button
      onClick={handleSend}
      disabled={!connected || !input.trim()}
      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all duration-150 hover:bg-[var(--accent-dim)] disabled:opacity-30 disabled:hover:bg-[var(--accent)] active:scale-95"
     >
      <ArrowUpIcon className="size-4" strokeWidth={2.5} />
     </button>
    </div>
    <p className="mt-2 text-center font-[var(--font-dm-mono),monospace] text-[10px] tracking-wide text-[var(--muted)]">
     Press Enter to send, Shift+Enter for a new line
    </p>
   </motion.div>
  </div>
 );
}

export default function ChatPage() {
 const { machines, loading } = useMachinesContext();
 const { messages, connected, connecting, isThinking, error, sendMessage } = useSandboxChat();
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const pinnedToBottomRef = useRef(true);
 const rafRef = useRef<number | null>(null);
 const router = useRouter();

 const machine = machines[0] ?? null;

 useEffect(() => {
  if (!loading && !machine) {
   router.replace("/console/dashboard");
  }
 }, [machine, loading, router]);

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
  return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
 }, []);

 if (loading || !machine) return null;

 return (
  <div className="relative flex h-[100svh] flex-col bg-[var(--bg)] text-[var(--text)]">
   <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
    <ConnectionStatus connected={connected} connecting={connecting} />
   </div>

   <div ref={scrollContainerRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto stable-gutter">
    <AnimatePresence>
     {messages.length === 0 && (
      <motion.div
       key="greeting"
       initial={{ opacity: 0, y: 12 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0 }}
       transition={{ duration: 0.3, ease: EASE }}
       className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none"
      >
       <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-1">
        <span className="text-2xl">✦</span>
       </div>
       <h2 className="text-base font-semibold text-[var(--text)]">How can I help?</h2>
       <p className="text-sm text-[var(--muted)] max-w-xs leading-relaxed">
        Send a message to start a conversation with your agent.
       </p>
      </motion.div>
     )}
    </AnimatePresence>
    <div className="mx-auto max-w-4xl px-6 py-6">
     <div className="flex flex-col gap-5">
      {messages.map((msg) => (
       <MessageRow key={msg.id} msg={msg} />
      ))}
      <motion.div animate={{ opacity: isThinking && connected ? 1 : 0 }}>
       <TypingIndicator />
      </motion.div>
     </div>
    </div>
   </div>

   <ChatInput connected={connected} onSend={sendMessage} />
  </div>
 );
}
