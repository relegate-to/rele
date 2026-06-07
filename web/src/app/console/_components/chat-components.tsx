"use client";

import { useEffect, useRef, useState, useCallback, memo, type KeyboardEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";
import { stripHiddenPrefix } from "@/hooks/sandbox-chat-protocol";
import { ToolIcon } from "@/components/ui/tool-icon";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import { useTranslation } from "../_context/i18n-context";

export const MODELS = [
  { id: "openrouter/anthropic/claude-opus-4-6", label: "Opus 4.6" },
  { id: "openrouter/anthropic/claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "openrouter/anthropic/claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "openrouter/openai/gpt-4o", label: "GPT-4o" },
  { id: "openrouter/openai/o3", label: "o3" },
  { id: "openrouter/google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "openrouter/meta-llama/llama-4-scout", label: "Llama 4 Scout" },
  { id: "openrouter/stepfun/step-3.5-flash:nitro", label: "Step 3.5 Flash", default: true },
];

const DEFAULT_MODEL = MODELS.find((m) => "default" in m && m.default)!;

function modelLabel(id: string | null): string {
  if (!id) return `Default · ${DEFAULT_MODEL.label}`;
  return MODELS.find((m) => m.id === id)?.label ?? id.split("/").pop() ?? id;
}

export function AssistantMessage({ children }: { content: string; children: ReactNode }) {
  return <>{children}</>;
}

const isAssistant = (role: string) => role === "assistant" || role === "tool";

function ToolPill({ msg }: { msg: ChatMessage }) {
  return (
    <div className="inline-flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 py-1 pl-1.5 pr-3 text-xs text-[var(--text)] backdrop-blur-sm">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--surface)]">
        <ToolIcon name={msg.toolName ?? ""} isError={msg.toolError} />
      </span>
      <span className="shrink-0 font-medium">{msg.toolName}</span>
      {msg.toolMeta && (
        <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{msg.toolMeta}</span>
      )}
    </div>
  );
}

export const MessageRow = memo(function MessageRow({ msg, compact, prevRole }: { msg: ChatMessage; compact?: boolean; prevRole?: string }) {
  const turnBoundary = !!prevRole && isAssistant(prevRole) !== isAssistant(msg.role);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn("min-w-0", !compact && turnBoundary && "mt-6")}
    >
      {msg.role === "user" ? (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5">
            <MarkdownProse variant="user">{stripHiddenPrefix(msg.content)}</MarkdownProse>
          </div>
        </div>
      ) : compact ? (
        <MarkdownProse isStreaming={msg.isStreaming}>
          {msg.content}
        </MarkdownProse>
      ) : (
        <AssistantMessage content={msg.content}>
          <div className="py-0">
            <MarkdownProse isStreaming={msg.isStreaming}>
              {msg.content}
            </MarkdownProse>
          </div>
        </AssistantMessage>
      )}
    </motion.div>
  );
});

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const numWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

type ToolPhrases = { one: string; many: (n: string) => string };
const TOOL_SUMMARY: Record<string, ToolPhrases> = {
  read: { one: "Read a file", many: (n) => `Read ${n} files` },
  edit: { one: "Edited a file", many: (n) => `Edited ${n} files` },
  write: { one: "Wrote a file", many: (n) => `Wrote ${n} files` },
  multiedit: { one: "Edited a file", many: (n) => `Edited ${n} files` },
  bash: { one: "Ran a command", many: (n) => `Ran ${n} commands` },
  grep: { one: "Searched", many: (n) => `Searched ${n} times` },
  glob: { one: "Looked up a file pattern", many: (n) => `Looked up ${n} file patterns` },
  webfetch: { one: "Fetched a page", many: (n) => `Fetched ${n} pages` },
  websearch: { one: "Ran a web search", many: (n) => `Ran ${n} web searches` },
};

function summarizeTools(msgs: ChatMessage[]): string {
  const names = msgs.map((m) => m.toolName).filter(Boolean) as string[];
  const n = msgs.length;
  if (names.length === 0) return n === 1 ? "Called a tool" : `Called ${numWord(n)} tools`;
  const unique = new Set(names.map((s) => s.toLowerCase()));
  if (unique.size === 1) {
    const key = names[0].toLowerCase();
    const fmt = TOOL_SUMMARY[key];
    if (n === 1) return fmt ? fmt.one : `Ran ${names[0]}`;
    return fmt ? fmt.many(numWord(n)) : `Ran ${names[0]} ${numWord(n)} times`;
  }
  return `Called ${numWord(n)} tools`;
}

const ToolGroup = memo(function ToolGroup({ msgs, prevRole, compact }: { msgs: ChatMessage[]; prevRole?: string; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const turnBoundary = !!prevRole && !isAssistant(prevRole);
  const uniqueIcons: string[] = [];
  for (const m of msgs) {
    const n = m.toolName ?? "";
    if (n && !uniqueIcons.includes(n)) uniqueIcons.push(n);
    if (uniqueIcons.length >= 3) break;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn("min-w-0", !compact && turnBoundary && "mt-6")}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group inline-flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 py-1 pl-1.5 pr-3 text-xs text-[var(--text)] backdrop-blur-sm transition-all duration-150 hover:border-[var(--accent)]/40 hover:bg-[var(--surface)]"
      >
        <span className="flex shrink-0 items-center -space-x-1.5">
          {uniqueIcons.map((name, i) => (
            <span
              key={name}
              className="flex size-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--surface)]"
              style={{ zIndex: uniqueIcons.length - i }}
            >
              <ToolIcon name={name} />
            </span>
          ))}
        </span>
        <span className="shrink-0 font-medium">{summarizeTools(msgs)}</span>
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:text-[var(--text)]",
            !expanded && "-rotate-90",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-2 flex flex-col gap-1 border-l border-dashed border-[var(--border)] pl-3">
              {msgs.map((m) => (
                <div key={m.id} className="min-w-0 overflow-hidden">
                  <ToolPill msg={m} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

type RenderGroup =
  | { kind: "single"; msg: ChatMessage; prevRole?: string }
  | { kind: "tools"; msgs: ChatMessage[]; prevRole?: string };

function groupMessages(messages: ChatMessage[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prevRole = messages[i - 1]?.role;
    if (msg.role === "tool") {
      const last = groups[groups.length - 1];
      if (last && last.kind === "tools") {
        last.msgs.push(msg);
        continue;
      }
      groups.push({ kind: "tools", msgs: [msg], prevRole });
    } else {
      groups.push({ kind: "single", msg, prevRole });
    }
  }
  return groups;
}

export function MessageList({ messages, compact }: { messages: ChatMessage[]; compact?: boolean }) {
  const groups = groupMessages(messages);
  return (
    <>
      {groups.map((g) =>
        g.kind === "single" ? (
          <MessageRow key={g.msg.id} msg={g.msg} prevRole={g.prevRole} compact={compact} />
        ) : (
          <ToolGroup key={g.msgs[0].id} msgs={g.msgs} prevRole={g.prevRole} compact={compact} />
        ),
      )}
    </>
  );
}

export interface ChatInputProps {
  connected: boolean;
  onSend: (text: string) => void;
  compact?: boolean;
  model?: string | null;
  onModelChange?: (model: string) => void;
}

export function ChatInput({ connected, onSend, compact = false, model, onModelChange }: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Close model picker on outside click
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelOpen]);

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
    <div className={`relative flex flex-col rounded-2xl border bg-[var(--surface)]/80 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_var(--border)] transition-all duration-200 focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.12),0_0_0_1px_var(--accent)] ${!connected ? "opacity-60" : ""}`}>
      {onModelChange && (
        <div ref={modelRef} className="relative flex items-center px-3 pt-2 pb-0">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--border)]/50"
          >
            <span>{modelLabel(model ?? null)}</span>
            <ChevronDownIcon className="size-3 opacity-60" />
          </button>
          <AnimatePresence>
            {modelOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.12, ease: EASE }}
                className="absolute bottom-full left-0 z-50 mb-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
              >
                <div
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--border)]/50 ${!model ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
                  onClick={() => { onModelChange(""); setModelOpen(false); }}
                >
                  Default
                </div>
                {MODELS.map((m) => (
                  <div
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--border)]/50 ${model === m.id ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
                    onClick={() => { onModelChange(m.id); setModelOpen(false); }}
                  >
                    <span>{m.label}</span>
                    {"default" in m && m.default && (
                      <span className="ml-auto text-[10px] text-[var(--muted)]">default</span>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="flex items-end gap-2 p-2 pl-4">
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
