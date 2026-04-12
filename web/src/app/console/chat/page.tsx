"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";
import { useChat } from "../_context/chat-context";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { MessageRow, ChatInput } from "../_components/chat-components";

export default function ChatPage() {
 const { machines, loading } = useMachinesContext();
 const { messages, connected, connecting, isThinking, sendMessage } = useChat();
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const pinnedToBottomRef = useRef(true);
 const rafRef = useRef<number | null>(null);
 const router = useRouter();

 const machine = machines[0] ?? null;

 useEffect(() => {
  if (!loading && !machine) {
   router.replace("/console/chat");
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
