"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Markdown from "react-markdown";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>{children}</span>;
}

export default function ChatPage() {
  const { machines, loading } = useMachinesContext();
  const { messages, connected, connecting, error, connect, sendMessage } = useSandboxChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput("");
  };

  if (loading || !machine) return null;

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3"
      >
        <div className="flex items-center gap-3">
          <h1 className="font-['Lora',Georgia,serif] text-lg italic">Agent</h1>
          <div className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                connected
                  ? "bg-[var(--status-success)]"
                  : connecting
                    ? "bg-[var(--status-warning)] animate-pulse"
                    : "bg-[var(--status-neutral)]"
              }`}
            />
            <Mono className="text-[11px] text-[var(--muted)]">
              {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
            </Mono>
          </div>
        </div>
        {!connected && !connecting && isRunning && (
          <button
            onClick={() => { connect(); }}
            className="rounded-md bg-[var(--copper)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Mono>{error ? "Retry" : "Connect"}</Mono>
          </button>
        )}
      </motion.div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-2.5">
          <Mono className="text-xs text-[var(--status-error,#e55)]">{error}</Mono>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-[680px] flex flex-col gap-4">
          {messages.length === 0 && connected && (
            <div className="flex items-center justify-center py-20">
              <p className="font-[var(--font-crimson-pro),serif] text-[var(--muted)]">
                Send a message to start chatting with your agent.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-[var(--copper)] text-white"
                    : "bg-[var(--surface-hi)] text-[var(--text)]"
                }`}
              >
                {msg.role === "user" ? (
                  <Mono className="text-sm whitespace-pre-wrap">{msg.content}</Mono>
                ) : (
                  <div className="max-w-none text-sm text-[var(--text)] [&_strong]:font-semibold [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_a]:text-[var(--copper)] [&_a]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mb-1 [&_code]:bg-[var(--surface)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-[var(--surface)] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_hr]:border-[var(--border)] [&_hr]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--muted)]">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] px-6 py-4">
        <div className="mx-auto max-w-[680px] flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={connected ? "Type a message..." : "Waiting for connection..."}
            disabled={!connected}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--copper)] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            className="rounded-lg bg-[var(--copper)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Mono>Send</Mono>
          </button>
        </div>
      </div>
    </div>
  );
}
