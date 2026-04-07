"use client";

// TODO: Tool calls are out of order sometimes.

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import { ToolIcon } from "@/components/ui/tool-icon";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { PROSE_CLASSES } from "@/lib/constants";

export default function ChatPage() {
 const { machines, loading } = useMachinesContext();
 const { messages, connected, connecting, isThinking, error, connect, sendMessage } = useSandboxChat();
 const [input, setInput] = useState("");
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const textareaRef = useRef<HTMLTextAreaElement>(null);
 const pinnedToBottomRef = useRef(true);
 const rafRef = useRef<number | null>(null);
 const router = useRouter();

 const machine = machines[0] ?? null;
 const isRunning = machine?.state === "started" || machine?.state === "running";

 useEffect(() => {
  if (!loading && !machine) {
   router.replace("/console/dashboard");
  }
 }, [machine, loading, router]);

 useEffect(() => {
  if (isRunning && !connected && !connecting && !error) {
   connect();
  }
 }, [isRunning, connected, connecting, error, connect]);

 const handleScroll = useCallback(() => {
  const el = scrollContainerRef.current;
  if (!el) return;
  pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
 }, []);

 const scrollToBottom = useCallback(() => {
  const el = scrollContainerRef.current;
  if (!el || !pinnedToBottomRef.current) return;

  if (rafRef.current !== null) {
   cancelAnimationFrame(rafRef.current);
  }

  const scroll = () => {
   const target = el.scrollHeight - el.clientHeight;
   const current = el.scrollTop;
   const diff = target - current;

   if (Math.abs(diff) < 2) {
    el.scrollTop = target;
    rafRef.current = null;
   } else {
    el.scrollTop += diff * 0.16;
    rafRef.current = requestAnimationFrame(scroll);
   }
  };

  rafRef.current = requestAnimationFrame(scroll);
 }, []);

 useEffect(() => {
  scrollToBottom();
 }, [messages, isThinking, scrollToBottom]);

 useEffect(() => {
  return () => {
   if (rafRef.current !== null) {
    cancelAnimationFrame(rafRef.current);
   }
  };
 }, []);

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
   <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
    <ConnectionStatus connected={connected} connecting={connecting} />
   </div>

   <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
    <div className="mx-auto max-w-4xl px-6 py-6">
     <div className="flex flex-col gap-5">
      {messages.map((msg) => (
       <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.35, ease: EASE }}
        className={msg.role === "tool" ? "-my-2" : ""}
       >
        {msg.role === "user" ? (
         <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5">
           <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
          </div>
         </div>
        ) : msg.role === "tool" ? (
         <div className="flex items-center">
          <div className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
           <ToolIcon name={msg.toolName ?? ""} isError={msg.toolError} />
           <span>{msg.toolName}</span>
          </div>
         </div>
        ) : (
         <MarkdownProse isStreaming={msg.isStreaming}>
          {msg.content}
         </MarkdownProse>
        )}
       </motion.div>
      ))}

      <motion.div animate={{ opacity: isThinking && connected ? 1 : 0 }}>
       <TypingIndicator />
      </motion.div>
     </div>
    </div>
   </div>

   <div className="px-6 pb-5 pt-2">
     <motion.div
       initial={{ opacity: 0, y: 16 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
       className="mx-auto max-w-4xl"
     >
       <div
         className={`
           relative flex items-end gap-2 rounded-2xl border
           bg-[var(--surface)]/80 backdrop-blur-sm
           p-2 pl-4
           shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_var(--border)]
           transition-all duration-200
           focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.12),0_0_0_1px_var(--accent)]
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
