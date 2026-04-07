"use client";

// TODO: Tool calls are out of order sometimes.

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
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
 const [displayedContent, setDisplayedContent] = useState("");
 const prevLengthRef = useRef(0);

 useEffect(() => {
  if (content.length > prevLengthRef.current) {
   setDisplayedContent(content);
   prevLengthRef.current = content.length;
  }
 }, [content]);

 return (
  <motion.div
   initial={{ opacity: 0.4 }}
   animate={{ opacity: 1 }}
   transition={{ duration: 0.2 }}
   className={PROSE_CLASSES}
  >
   <Markdown remarkPlugins={[remarkBreaks]}>
    {displayedContent}
   </Markdown>
  </motion.div>
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
   <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: EASE }}
    className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2"
   >
    <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
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
      {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
     </span>
    </div>
   </motion.div>

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
        ) : msg.isStreaming ? (
         <AnimatedText content={msg.content} />
        ) : (
         <div className={PROSE_CLASSES}>
          <Markdown remarkPlugins={[remarkBreaks]}>
           {msg.content}
          </Markdown>
         </div>
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
    <div className="mx-auto max-w-4xl">
     <div className="flex items-end gap-2 rounded-2xl border bg-[var(--surface)] p-2 pl-4">
      <textarea
       ref={textareaRef}
       value={input}
       onChange={(e) => setInput(e.target.value)}
       onKeyDown={handleKeyDown}
       disabled={!connected}
       rows={1}
       className="flex-1 resize-none bg-transparent text-sm focus:outline-none"
      />
      <button onClick={handleSend} disabled={!connected || !input.trim()}>
       <ArrowUpIcon className="size-4" />
      </button>
     </div>
    </div>
   </div>
  </div>
 );
}
