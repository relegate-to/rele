"use client";

import { useEffect, useMemo, useRef, useState, useCallback, memo, type KeyboardEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { ChatMessage, PromptSpec } from "@/hooks/sandbox-chat-protocol";
import { stripHiddenPrefix, stripUserContextPrefix, extractPrompt, PROMPT_START } from "@/hooks/sandbox-chat-protocol";
import { ToolIcon } from "@/components/ui/tool-icon";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import { useTranslation } from "../_context/i18n-context";
import { PromptForm, PromptDescription } from "./prompt-form";

export const MODELS = [
  { id: "openrouter/anthropic/claude-opus-4-7", label: "Opus 4.7" },
  { id: "openrouter/anthropic/claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "openrouter/anthropic/claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "openrouter/openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openrouter/openai/gpt-5-nano", label: "GPT-5 Nano" },
  { id: "openrouter/google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "openrouter/deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "openrouter/deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", default: true },
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

export type PromptReply = (id: string, displayValue: string, structured: unknown) => void;

function InlinePrompt({ spec, onReply, answeredWith }: { spec: PromptSpec; onReply?: PromptReply; answeredWith?: string }) {
  if (answeredWith !== undefined) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1 text-xs text-[var(--muted)] backdrop-blur-sm">
        <span className="opacity-60">→</span>
        <span className="truncate text-[var(--text)]">{answeredWith}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 backdrop-blur-sm">
      {spec.title && (
        <div className="mb-1 text-sm font-medium text-[var(--text)]">{spec.title}</div>
      )}
      {spec.description && (
        <PromptDescription className="mb-3 text-xs text-[var(--muted)]">{spec.description}</PromptDescription>
      )}
      <PromptForm
        spec={spec}
        disabled={!onReply}
        onSubmit={(display, structured) => onReply?.(spec.id, display, structured)}
      />
    </div>
  );
}

export const MessageRow = memo(function MessageRow({ msg, compact, prevRole, onPromptReply, answeredPrompts }: { msg: ChatMessage; compact?: boolean; prevRole?: string; onPromptReply?: PromptReply; answeredPrompts?: Map<string, string> }) {
  const turnBoundary = !!prevRole && isAssistant(prevRole) !== isAssistant(msg.role);

  const isNotice = msg.gatewayNotice || msg.role === "system";
  const compactNotice = isNotice && !msg.content.includes("\n") && msg.content.length <= 80;

  if (compactNotice) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className={cn("flex items-center gap-3 py-1", !compact && turnBoundary && "mt-6")}
      >
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)] backdrop-blur-sm">
          {msg.content}
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </motion.div>
    );
  }

  if (isNotice) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className={cn("min-w-0", !compact && turnBoundary && "mt-6")}
      >
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40 px-4 py-3 font-[var(--font-dm-mono),monospace] text-xs leading-relaxed text-[var(--muted)] backdrop-blur-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </motion.div>
    );
  }

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
            <MarkdownProse variant="user">{stripUserContextPrefix(stripHiddenPrefix(msg.content))}</MarkdownProse>
          </div>
        </div>
      ) : (() => {
        const extracted = extractPrompt(msg.content);
        // Streaming partial: if PROMPT_START has arrived but PROMPT_END hasn't,
        // hide the in-progress block so raw JSON doesn't flash into the bubble.
        const visibleContent = (() => {
          if (extracted) return msg.content;
          const i = msg.content.indexOf(PROMPT_START);
          return i === -1 ? msg.content : msg.content.slice(0, i);
        })();
        const before = extracted ? extracted.before : visibleContent;
        const after = extracted ? extracted.after : "";

        const body = (
          <>
            {before && (
              <MarkdownProse isStreaming={msg.isStreaming && !extracted}>
                {before}
              </MarkdownProse>
            )}
            {extracted && (
              <div className="my-2">
                <InlinePrompt
                  spec={extracted.prompt}
                  onReply={onPromptReply}
                  answeredWith={answeredPrompts?.get(extracted.prompt.id)}
                />
              </div>
            )}
            {after && (
              <MarkdownProse isStreaming={msg.isStreaming}>{after}</MarkdownProse>
            )}
          </>
        );

        return compact ? body : <div className="py-0">{body}</div>;
      })()}
    </motion.div>
  );
});

type ToolPhrases = { one: string; many: (n: number) => string };
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
  if (names.length === 0) return n === 1 ? "Called a tool" : `Called ${n} tools`;
  const unique = new Set(names.map((s) => s.toLowerCase()));
  if (unique.size === 1) {
    const key = names[0].toLowerCase();
    const fmt = TOOL_SUMMARY[key];
    if (n === 1) return fmt ? fmt.one : `Ran ${names[0]}`;
    return fmt ? fmt.many(n) : `Ran ${names[0]} ${n} times`;
  }
  return `Called ${n} tools`;
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

function renderMessages(messages: ChatMessage[], compact?: boolean, onPromptReply?: PromptReply, answeredPrompts?: Map<string, string>) {
  const visible = messages.filter((m) => {
    if (m.role === "user" && isKnownSlashMessage(stripHiddenPrefix(m.content))) return false;
    // Bare compaction marker — the paired gateway-injected assistant message
    // carries the human-readable summary, so skip the marker itself.
    if (m.role === "system" && m.systemKind === "compaction") return false;
    // Prompt replies are represented by the "→ answered" chip on the prompt
    // itself; suppress the duplicate user bubble.
    if (m.role === "user" && m.promptReplyId) return false;
    return true;
  });
  const groups = groupMessages(visible);
  return groups.map((g) =>
    g.kind === "single" ? (
      <MessageRow key={g.msg.id} msg={g.msg} prevRole={g.prevRole} compact={compact} onPromptReply={onPromptReply} answeredPrompts={answeredPrompts} />
    ) : (
      <ToolGroup key={g.msgs[0].id} msgs={g.msgs} prevRole={g.prevRole} compact={compact} />
    ),
  );
}

function CompactionCollapse({ msgs, compact, onPromptReply, answeredPrompts }: { msgs: ChatMessage[]; compact?: boolean; onPromptReply?: PromptReply; answeredPrompts?: Map<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="min-w-0"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] bg-[var(--surface)]/40 px-3 py-1 text-[11px] text-[var(--muted)] backdrop-blur-sm transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
      >
        <ChevronDownIcon className={cn("size-3 transition-transform duration-200", !expanded && "-rotate-90")} />
        <span>{expanded ? "Hide" : "Show"} {msgs.length} earlier message{msgs.length === 1 ? "" : "s"} before compaction</span>
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
            <div className="mt-3 flex flex-col gap-3 border-l border-dashed border-[var(--border)] pl-3 opacity-70">
              {renderMessages(msgs, compact, onPromptReply, answeredPrompts)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MessageList({ messages, compact, onPromptReply }: { messages: ChatMessage[]; compact?: boolean; onPromptReply?: PromptReply }) {
  const answeredPrompts = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.role === "user" && m.promptReplyId) {
        // The displayed value is the stripped content of the user message.
        map.set(m.promptReplyId, stripUserContextPrefix(stripHiddenPrefix(m.content)));
      }
    }
    return map;
  }, [messages]);
  // Find the most recent compaction boundary; everything before it gets
  // collapsed since the assistant has already been re-grounded on a summary.
  let boundary = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "system" && messages[i].systemKind === "compaction") {
      boundary = i;
      break;
    }
  }
  const before = boundary > 0 ? messages.slice(0, boundary) : [];
  const after = boundary >= 0 ? messages.slice(boundary) : messages;
  return (
    <>
      {before.length > 0 && (
        <CompactionCollapse key={`compact:${boundary}`} msgs={before} compact={compact} onPromptReply={onPromptReply} answeredPrompts={answeredPrompts} />
      )}
      {renderMessages(after, compact, onPromptReply, answeredPrompts)}
    </>
  );
}

// --- Slash commands ---
// Dispatched as plain text via chat.send — OpenClaw parses server-side.
// Not yet exposed in the picker (track here for completeness):
//   /allowlist /acp /focus /unfocus /agents /activation /send  (admin/routing)
//   /tts /export-session                                       (media/export)
//   /dock_telegram /dock_discord /dock_slack                   (dock switching)
//   /pair /phone /voice                                        (plugin-specific)
//   /bash                                                      (host-only, sensitive)

type SlashCommand = {
  name: string;            // canonical, no leading slash
  aliases?: string[];
  desc: string;
  hasArgs?: boolean;       // if true, accepting inserts "/name " (waits for args)
  category: string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  // Session
  { name: "session", aliases: [], desc: "Manage session-level settings", hasArgs: true, category: "Session" },
  { name: "stop", desc: "Stop the current run", category: "Session" },
  { name: "reset", aliases: ["clear"], desc: "Clear context of the current session", category: "Session" },
  { name: "compact", desc: "Compact the session context", category: "Session" },

  // Options
  { name: "usage", desc: "Usage footer or cost summary", category: "Options" },
  { name: "think", aliases: ["thinking", "t"], desc: "Set thinking level", hasArgs: true, category: "Options" },
  { name: "verbose", aliases: ["v"], desc: "Toggle verbose mode", category: "Options" },
  { name: "fast", desc: "Toggle fast mode", category: "Options" },
  { name: "reasoning", aliases: ["reason"], desc: "Toggle reasoning visibility", category: "Options" },
  { name: "elevated", aliases: ["elev"], desc: "Toggle elevated mode", category: "Options" },
  { name: "exec", desc: "Set exec defaults for this session", hasArgs: true, category: "Options" },
  { name: "model", desc: "Show or set the model", hasArgs: true, category: "Options" },
  { name: "models", desc: "List model providers or provider models", category: "Options" },
  { name: "queue", desc: "Adjust queue settings", hasArgs: true, category: "Options" },

  // Status
  { name: "help", desc: "Show available commands", category: "Status" },
  { name: "commands", desc: "List all slash commands", category: "Status" },
  { name: "tools", desc: "List available runtime tools", category: "Status" },
  { name: "status", desc: "Show current status", category: "Status" },
  { name: "context", desc: "Explain how context is built and used", category: "Status" },
  { name: "whoami", aliases: ["id"], desc: "Show your sender id", category: "Status" },

  // Management
  { name: "approve", desc: "Approve or deny exec requests", hasArgs: true, category: "Management" },
  { name: "subagents", desc: "Manage subagent runs for this session", hasArgs: true, category: "Management" },
  { name: "kill", desc: "Kill a running subagent (or all)", hasArgs: true, category: "Management" },
  { name: "steer", aliases: ["tell"], desc: "Send guidance to a running subagent", hasArgs: true, category: "Management" },

  // Tools
  { name: "skill", desc: "Run a skill by name", hasArgs: true, category: "Tools" },
  { name: "btw", desc: "Ask a side question without changing future context", hasArgs: true, category: "Tools" },
  { name: "restart", desc: "Restart OpenClaw", category: "Tools" },
];

const KNOWN_SLASH_NAMES = new Set<string>(
  SLASH_COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]),
);

function isKnownSlashMessage(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("/")) return false;
  if (t.includes("\n")) return false;
  const word = t.slice(1).split(/\s+/, 1)[0]?.toLowerCase();
  return !!word && KNOWN_SLASH_NAMES.has(word);
}

function matchSlash(input: string): { query: string; matches: SlashCommand[] } | null {
  if (!input.startsWith("/")) return null;
  const rest = input.slice(1);
  // Picker shows only while the user is typing the command word (no space yet).
  if (/\s/.test(rest)) return null;
  const q = rest.toLowerCase();
  const matches = SLASH_COMMANDS.filter((c) => {
    if (!q) return true;
    if (c.name.startsWith(q)) return true;
    if (c.aliases?.some((a) => a.startsWith(q))) return true;
    return c.name.includes(q);
  });
  return { query: q, matches };
}

function SlashPicker({
  matches,
  activeIdx,
  onPick,
  onHover,
}: {
  matches: SlashCommand[];
  activeIdx: number;
  onPick: (cmd: SlashCommand) => void;
  onHover: (i: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.12, ease: EASE }}
      className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[280px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
    >
      {matches.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[var(--muted)]">No matching commands</div>
      ) : (
        matches.map((c, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={c.name}
              ref={active ? activeRef : undefined}
              type="button"
              onMouseEnter={() => onHover(i)}
              onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
              className={cn(
                "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                active ? "bg-[var(--border)]/60 text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--border)]/30",
              )}
            >
              <span className="font-mono font-medium text-[var(--text)]">/{c.name}</span>
              {c.aliases && c.aliases.length > 0 && (
                <span className="font-mono text-[10px] opacity-60">
                  {c.aliases.map((a) => `/${a}`).join(" ")}
                </span>
              )}
              <span className="ml-auto truncate pl-2 text-right">{c.desc}</span>
            </button>
          );
        })
      )}
    </motion.div>
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
  const [slashIdx, setSlashIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const slash = useMemo(() => matchSlash(input), [input]);
  useEffect(() => { setSlashIdx(0); }, [slash?.query]);
  const slashOpen = !!slash && slash.matches.length > 0;

  const applySlash = useCallback((cmd: SlashCommand) => {
    const next = cmd.hasArgs ? `/${cmd.name} ` : `/${cmd.name}`;
    setInput(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = next.length;
        el.setSelectionRange(pos, pos);
      }
    });
  }, []);

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
      if (slashOpen && slash) {
        const n = slash.matches.length;
        if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % n); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + n) % n); return; }
        if (e.key === "Tab") { e.preventDefault(); applySlash(slash.matches[slashIdx]); return; }
        if (e.key === "Escape") { e.preventDefault(); setInput(""); return; }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const cmd = slash.matches[slashIdx];
          if (cmd.hasArgs) { applySlash(cmd); }
          else { onSend(`/${cmd.name}`); setInput(""); }
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    },
    [handleSend, slashOpen, slash, slashIdx, applySlash, onSend]
  );

  const innerBox = (
    <div className={`relative flex flex-col rounded-2xl border bg-[var(--surface)]/80 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_var(--border)] transition-all duration-200 focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.12),0_0_0_1px_var(--accent)] ${!connected ? "opacity-60" : ""}`}>
      <AnimatePresence>
        {slashOpen && slash && (
          <SlashPicker
            matches={slash.matches}
            activeIdx={slashIdx}
            onPick={applySlash}
            onHover={setSlashIdx}
          />
        )}
      </AnimatePresence>
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
