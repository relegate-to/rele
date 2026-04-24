"use client";

// TODO: Restore skill log when exiting and returning to modal.
// Improve status at end of install.
// Fix messages not showing in log.

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  DownloadIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useGateway } from "../_context/gateway-context";
import { useChat } from "../_context/chat-context";
import { useSessions } from "../_context/sessions-context";
import { MessageRow } from "../_components/chat-components";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { CornerTab } from "@/components/ui/corner-tab";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";

const INSTANCE_PROXY = "/api/instance";

// ── Emoji color extraction ───────────────────────────────────────────────────

const emojiColorCache = new Map<string, string>();

function getEmojiColor(emoji: string): string | null {
  if (emojiColorCache.has(emoji)) return emojiColorCache.get(emoji)!;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.font = "56px 'Noto Color Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 32, 36);

  const { data } = ctx.getImageData(0, 0, 64, 64);
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  if (count === 0) return null;

  const color = `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`;
  emojiColorCache.set(emoji, color);
  return color;
}

function useEmojiColor(emoji: string | null) {
  const [color, setColor] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || !emoji) return;
    const id = requestIdleCallback(() => setColor(getEmojiColor(emoji)));
    return () => cancelIdleCallback(id);
  }, [mounted, emoji]);
  return color;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillStatus = "ready" | "missing-deps" | "needs-config" | "disabled";
type FilterTab = "all" | "ready" | "needs-setup" | "enabled";

interface InstallEntry {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  enabled: boolean;
  status: SkillStatus;
  missingBins: string[];
  missingAnyBins: string[];
  missingEnv: string[];
  missingConfig: string[];
  pluginConfig: Record<string, unknown> | null;
  installEntries: InstallEntry[];
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${INSTANCE_PROXY}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ── Filter helpers ────────────────────────────────────────────────────────────

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "enabled", label: "Enabled" },
  { id: "ready", label: "Disabled" },
  { id: "needs-setup", label: "Needs setup" },
];

function hasAllDeps(s: Skill) {
  return s.missingBins.length === 0 && (s.missingAnyBins ?? []).length === 0 && s.missingEnv.length === 0 && s.missingConfig.length === 0;
}

function filterSkills(skills: Skill[], filter: FilterTab): Skill[] {
  switch (filter) {
    case "enabled":     return skills.filter((s) => s.enabled && s.status !== "missing-deps" && s.status !== "needs-config");
    case "ready":       return skills.filter((s) => !s.enabled && (s.status === "ready" || (s.status === "disabled" && hasAllDeps(s))));
    case "needs-setup": return skills.filter((s) => s.status === "missing-deps" || s.status === "needs-config");
    default:            return skills;
  }
}

// ── Install button ────────────────────────────────────────────────────────────

type InstallState = "idle" | "running" | "done" | "error";

function InstallButton({ skillId, entry, onDone, onStateChange }: { skillId: string; entry: InstallEntry; onDone: () => void; onStateChange?: (state: InstallState) => void }) {
  const [state, setState] = useState<InstallState>("idle");
  const [output, setOutput] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const setStateAndNotify = (s: InstallState) => {
    setState(s);
    onStateChange?.(s);
  };

  const install = async () => {
    setStateAndNotify("running");
    setOutput(null);
    try {
      const { jobId } = await apiFetch(`/api/skills/${skillId}/install/${entry.id}`, { method: "POST" });
      pollRef.current = setInterval(async () => {
        try {
          const job = await apiFetch(`/api/skills/install/${jobId}`);
          if (job.output) setOutput(job.output);
          if (job.status === "done") { stopPolling(); setStateAndNotify("done"); onDone(); }
          else if (job.status === "error") { stopPolling(); setOutput(job.output || job.error || null); setStateAndNotify("error"); }
        } catch {}
      }, 500);
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Failed to start");
      setStateAndNotify("error");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={install}
        disabled={state === "running" || state === "done"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
          state === "done"   ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
          : state === "error" ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
                              : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-hi)]",
        )}
      >
        {state === "running" ? <RefreshCwIcon className="size-3.5 animate-spin" />
         : state === "done"  ? <CheckCircle2Icon className="size-3.5" />
                              : <DownloadIcon className="size-3.5" />}
        {state === "running" ? "Installing…" : state === "done" ? "Installed" : entry.label}
      </button>
      <AnimatePresence>
        {(state === "running" || output) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <pre className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[11px] text-[var(--text-dim)] whitespace-pre-wrap break-all h-40 overflow-y-auto">
              {output ?? <span className="animate-pulse">…</span>}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useSessionObserver(sessionKey: string | null) {
  const { observeSession, getSessionMessages, getSessionThinking } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    if (!sessionKey) { setMessages([]); setIsThinking(false); return; }
    setMessages(getSessionMessages(sessionKey));
    setIsThinking(getSessionThinking(sessionKey));
    return observeSession(sessionKey, () => {
      setMessages(getSessionMessages(sessionKey));
      setIsThinking(getSessionThinking(sessionKey));
    });
  }, [sessionKey, observeSession, getSessionMessages, getSessionThinking]);

  return { messages, isThinking };
}

type InstallResult = "ok" | "fail" | "attention" | null;

function detectResult(messages: ChatMessage[]): InstallResult {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.content.includes("INSTALL_OK")) return "ok";
    if (m.content.includes("INSTALL_FAIL")) return "fail";
    if (m.content.includes("INSTALL_ATTENTION")) return "attention";
    break; // only check the last assistant message
  }
  return null;
}

const STATUS_RE = /^[*_]*STATUS:\s*(.+?)[\s*_]*$/m;
const CODEWORD_RE = /\n?INSTALL_(OK|FAIL|ATTENTION)\b[\s\S]*$/;

function latestStatus(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const match = m.content.match(STATUS_RE);
    if (match) return match[1].trim();
  }
  return null;
}

function stripMarkers(content: string): string {
  return content.replace(STATUS_RE, "").replace(CODEWORD_RE, "").trim();
}

function AskAiInstallButton({ skill, onChanged, initialSessionKey, initialSessionLabel, onSessionStart }: { skill: Skill; onChanged: () => void; initialSessionKey?: string; initialSessionLabel?: string; onSessionStart: (sessionKey: string, label: string) => void }) {
  const { sendToSession } = useChat();
  const { createSession, setActiveSessionKey } = useSessions();
  const router = useRouter();
  const [sessionKey, setSessionKey] = useState<string | null>(initialSessionKey ?? null);
  const [sessionLabel, setSessionLabel] = useState<string | null>(initialSessionLabel ?? null);
  const [expanded, setExpanded] = useState(false);
  const [latchedResult, setLatchedResult] = useState<InstallResult>(null);
  const [logReady, setLogReady] = useState(false);
  const { messages, isThinking } = useSessionObserver(sessionKey);

  // Pre-render log content once idle so expand animation doesn't lag
  useEffect(() => {
    if (!sessionKey || logReady) return;
    const id = requestIdleCallback(() => setLogReady(true));
    return () => cancelIdleCallback(id);
  }, [sessionKey, logReady]);

  const liveResult = detectResult(messages);
  const result = latchedResult ?? liveResult;
  const running = sessionKey !== null && result === null;
  const latestLine = latestStatus(messages);
  const visibleMessages = messages.filter((m) => m.role !== "user");

  // Strip STATUS lines and codewords from displayed messages
  const displayMessages = visibleMessages.map((m) => {
    if (m.role !== "assistant") return m;
    const cleaned = stripMarkers(m.content);
    if (cleaned === m.content) return m;
    return { ...m, content: cleaned };
  }).filter((m) => m.role !== "assistant" || m.content.length > 0);

  // Latch the result so it survives session cleanup
  useEffect(() => {
    if (liveResult && !latchedResult) setLatchedResult(liveResult);
  }, [liveResult, latchedResult]);

  // Refresh skills list on completion
  useEffect(() => {
    if (result) onChanged();
  }, [result, onChanged]);

  const handleClick = async () => {
    const allMissing = [...skill.missingBins, ...(skill.missingAnyBins ?? [])];
    const bins = allMissing.length > 0 ? allMissing.join(", ") : "its dependencies";
    const label = `.tmp install ${bins}`;
    const key = await createSession(label, false);
    setSessionKey(key);
    setSessionLabel(label);
    onSessionStart(key, label);
    sendToSession(
      key,
      `Install ${allMissing.join(", ") || "dependencies"} for "${skill.name}". Check /app/skills/${skill.id}/SKILL.md first — it usually has install instructions. Verify on PATH after. Before each action send "STATUS: <1-5 words>" (e.g. "STATUS: Installing via apt"). End final message with INSTALL_OK, INSTALL_FAIL, or INSTALL_ATTENTION.`,
    );
  };

  const goToSession = () => {
    if (!sessionKey) return;
    setActiveSessionKey(sessionKey);
    router.push("/console/chat");
  };

  const hasMissing = skill.missingBins.length > 0 || (skill.missingAnyBins ?? []).length > 0;
  const stateKey = !sessionKey ? "idle" : result ? "result" : "running";

  // Hide entirely when idle with no missing deps
  if (!sessionKey && !hasMissing) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {stateKey === "idle" && (
        <motion.div
          key="idle"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <button
            onClick={handleClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white transition-all hover:bg-[var(--accent-dim)] active:scale-[0.98]"
          >
            <SparklesIcon className="size-3.5" />
            Install with OpenClaw
          </button>
        </motion.div>
      )}

      {stateKey === "result" && result && (() => {
        const config = {
          ok:        { icon: CheckCircle2Icon, label: "Installed successfully", border: "border-[var(--status-success-border)]", bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
          fail:      { icon: XCircleIcon,      label: "Installation failed",    border: "border-[var(--status-error-border)]",   bg: "bg-[var(--status-error-bg)]",   text: "text-[var(--status-error-text)]" },
          attention: { icon: AlertTriangleIcon, label: "Needs attention",        border: "border-[var(--status-warning-border)]", bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning-text)]" },
        }[result];
        const Icon = config.icon;

        return (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="space-y-2"
          >
            <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", config.border, config.bg)}>
              <Icon className={cn("size-3.5 shrink-0", config.text)} />
              <span className={cn("flex-1 text-xs font-medium", config.text)}>{config.label}</span>
              {displayMessages.length > 0 && (
                <button onClick={() => setExpanded((v) => !v)} className={cn("transition-colors", config.text)}>
                  <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
                </button>
              )}
            </div>
            {logReady && (
              <motion.div
                initial={false}
                animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="overflow-hidden rounded-lg"
              >
                <div className="relative rounded-lg border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <FadeScroll className="rounded-lg" innerClassName="h-60 p-3 overflow-x-auto">
                    <div className="flex flex-col gap-3 min-w-0 break-words overflow-hidden">
                      {displayMessages.map((msg) => (
                        <MessageRow key={msg.id} msg={msg} compact />
                      ))}
                    </div>
                  </FadeScroll>
                  {sessionLabel && (
                    <CornerTab onClick={goToSession}>{sessionLabel}</CornerTab>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })()}

      {stateKey === "running" && (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <RefreshCwIcon className="size-3.5 shrink-0 animate-spin text-[var(--accent)]" />
            <span className="flex-1 min-w-0 truncate text-xs text-[var(--text-dim)]">
              {latestLine ?? "Installing…"}
            </span>
            {displayMessages.length > 0 && (
              <button onClick={() => setExpanded((v) => !v)} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              </button>
            )}
          </div>
          {logReady && (
            <motion.div
              initial={false}
              animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden rounded-lg"
            >
              <div className="relative rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <FadeScroll className="rounded-lg" innerClassName="h-60 p-3" pinToBottom>
                  <div className="flex flex-col gap-3">
                    {displayMessages.map((msg) => (
                      <MessageRow key={msg.id} msg={msg} compact />
                    ))}
                    {isThinking && <TypingIndicator />}
                  </div>
                </FadeScroll>
                {sessionLabel && (
                  <CornerTab onClick={goToSession}>{sessionLabel}</CornerTab>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Config editor ─────────────────────────────────────────────────────────────

function ConfigEditor({ skillId, initial, onSaved }: { skillId: string; initial: Record<string, unknown> | null; onSaved: () => void }) {
  const { rpc } = useGateway();
  const [value, setValue] = useState(initial ? JSON.stringify(initial, null, 2) : "{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const parsed = JSON.parse(value);
      const config = await rpc("config.get");
      const hash = (config as Record<string, unknown>)?.hash as string | undefined;
      await rpc("config.patch", {
        patch: { plugins: { entries: { [skillId]: parsed } } },
        ...(hash ? { hash } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none resize-none"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {error && <p className="text-xs text-[var(--status-error-text)]">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hi)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save config"}
      </button>
    </div>
  );
}

// ── Skill card ────────────────────────────────────────────────────────────────

function SkillCard({ skill, onChanged, onToggled, installSessionKey, installSessionLabel, onInstallSessionStart }: { skill: Skill; onChanged: () => void; onToggled: (skillId: string, lockedStatus: SkillStatus, newEnabled: boolean) => void; installSessionKey?: string; installSessionLabel?: string; onInstallSessionStart: (skillId: string, sessionKey: string, label: string) => void }) {
  const [toggling, setToggling] = useState(false);
  const emojiColor = useEmojiColor(skill.emoji ?? "🔧");
  const [open, setOpen] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  const doToggle = async () => {
    setToggling(true);
    onToggled(skill.id, skill.status, !skill.enabled);
    try {
      await apiFetch(`/api/skills/${skill.id}/${skill.enabled ? "disable" : "enable"}`, { method: "POST" });
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggling(false);
    }
  };

  const missingAnyBins = skill.missingAnyBins ?? [];
  const missingEnv = skill.missingEnv ?? [];

  const { messages: installMessages } = useSessionObserver(installSessionKey ?? null);
  const installResult = detectResult(installMessages);
  const needsSetup = (skill.status === "missing-deps" || skill.status === "needs-config") && installResult !== "ok";
  const hasDetails = skill.pluginConfig !== null || skill.missingBins.length > 0 || missingAnyBins.length > 0 || missingEnv.length > 0 || skill.missingConfig.length > 0 || skill.installEntries.length > 0 || !!installSessionKey;

  const dotColor =
    skill.status === "ready"          ? "bg-[var(--status-success-text)]"
    : needsSetup                      ? "bg-[var(--status-warning-text)]"
                                      : "bg-[var(--border-hi)]";

  const statusLabel =
    skill.status === "ready"          ? "Active"
    : skill.status === "missing-deps" ? "Missing deps"
    : skill.status === "needs-config" ? "Needs config"
                                      : "Disabled";


  const statusBadgeClass =
    skill.status === "ready"          ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)] ring-1 ring-[var(--status-success)]"
    : needsSetup                      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] ring-1 ring-[var(--status-warning)]"
                                      : "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] ring-1 ring-[var(--status-neutral)]";

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex h-32 flex-row rounded-md bg-[var(--surface)] cursor-pointer overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--surface-hi)]/30 hover:shadow-[0_4px_16px_-2px_rgba(99,102,241,0.15)] active:scale-[0.98] active:shadow-sm",
          !skill.enabled && !needsSetup && "opacity-50 hover:opacity-100",
        )}
      >
        {/* Emoji panel */}
        <div
          className="relative flex w-16 shrink-0 items-center justify-center overflow-hidden "
          style={{ background: emojiColor ? `linear-gradient(145deg, rgba(${emojiColor}, 0.5), rgba(${emojiColor}, 0.3))` : "var(--surface-hi)" }}
        >
          <span className="relative text-[5rem] leading-none opacity-85 rotate-[5deg] pointer-events-none" style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none" }}>{skill.emoji ?? "🔧"}</span>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Name + description */}
          <div className="flex-1 min-h-0 px-3.5 py-2.5">
            <p className="text-sm font-semibold text-[var(--text)] leading-snug truncate">
              {skill.name}
            </p>
            {skill.description && (
              <p className="mt-1 text-[11px] text-[var(--text-dim)] leading-relaxed line-clamp-2">
                {skill.description}
              </p>
            )}
          </div>

          {/* Footer: badge + toggle */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-[var(--surface-hi)]/50">
            <span className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
              statusBadgeClass,
            )}>
              <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
              {statusLabel}
            </span>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Switch
                checked={skill.enabled && !needsSetup}
                onClick={() => { void doToggle(); }}
                disabled={toggling || needsSetup}
                title={needsSetup ? "Fix issues before enabling" : skill.enabled ? "Disable" : "Enable"}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90svh] overflow-y-auto overflow-x-hidden p-0">

          {/* Hero header with gradient */}
          <div
            className="relative overflow-hidden rounded-t-lg px-5 pt-5 pb-4"
            style={{ background: emojiColor ? `linear-gradient(145deg, rgba(${emojiColor}, 0.6), rgba(${emojiColor}, 0.35))` : "var(--surface-hi)" }}
          >
            {/* Dark saturated wash behind text for contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" style={{ backdropFilter: "saturate(1.5)" }} />
            <span className="absolute -right-4 -top-4 text-[7rem] leading-none opacity-50 rotate-[5deg] pointer-events-none" style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none" }}>{skill.emoji ?? "🔧"}</span>
            <div className="relative flex flex-col gap-2">
              <DialogTitle className="text-base font-semibold leading-tight text-white">
                {skill.name}
              </DialogTitle>
              <span className={cn(
                "inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm",
                statusBadgeClass,
              )}>
                <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2">
          {skill.description && (
            <p className="text-xs text-[var(--text-dim)] leading-relaxed mb-5">
              {skill.description}
            </p>
          )}

          {/* Enable row */}
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-5">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Enable skill</p>
              {needsSetup && (
                <p className="text-xs text-[var(--status-warning-text)]">Fix issues before enabling</p>
              )}
            </div>
            <Switch
              checked={skill.enabled && !needsSetup}
              onClick={() => { void doToggle(); }}
              disabled={toggling || needsSetup}
            />
          </div>

          {/* Details */}
          {hasDetails && (
            <div className="min-w-0 border-t border-[var(--border)] pt-5 mt-5">
              <AnimatePresence mode="sync">
                {(skill.missingBins.length > 0 || missingAnyBins.length > 0 || missingEnv.length > 0 || skill.missingConfig.length > 0) && (
                  <motion.div
                    key="warnings"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--surface)] p-3 space-y-3 mb-4">
                      {skill.missingBins.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Missing binaries</p>
                          <div className="flex flex-wrap gap-1.5">
                            {skill.missingBins.map((bin) => (
                              <code key={bin} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-dim)]">
                                {bin}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                      {missingAnyBins.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Needs one of</p>
                          <div className="flex flex-wrap gap-1.5">
                            {missingAnyBins.map((bin) => (
                              <code key={bin} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-dim)]">
                                {bin}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                      {missingEnv.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Missing env vars</p>
                          <div className="flex flex-wrap gap-1.5">
                            {missingEnv.map((v) => (
                              <code key={v} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-dim)]">
                                {v}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                      {skill.missingConfig.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Missing config keys</p>
                          <div className="flex flex-wrap gap-1.5">
                            {skill.missingConfig.map((path) => (
                              <code key={path} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-dim)]">
                                {path}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                {!installSessionKey && (skill.installEntries.length > 0 || skill.missingBins.length > 0 || missingAnyBins.length > 0) && (
                  <motion.div
                    key="install-options"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Install</p>
                      <div className="relative space-y-2">
                        <AnimatePresence mode="sync">
                          {skill.installEntries.filter((e) => !activeEntryId || e.id === activeEntryId).map((entry, i) => (
                            <motion.div
                              key={`${entry.id}-${i}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0, position: "absolute", width: "100%" }}
                              transition={{ duration: 0.2, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <InstallButton skillId={skill.id} entry={entry} onDone={onChanged} onStateChange={(s) => { if (s === "running") setActiveEntryId(entry.id); else if (s === "done" || s === "error") setActiveEntryId(null); }} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
                {!activeEntryId && (
                  <motion.div
                    key="ai-install"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <AskAiInstallButton skill={skill} onChanged={onChanged} initialSessionKey={installSessionKey} initialSessionLabel={installSessionLabel} onSessionStart={(key, label) => onInstallSessionStart(skill.id, key, label)} />
                  </motion.div>
                )}
                {skill.pluginConfig !== null && (
                  <motion.div key="config" transition={{ duration: 0.25, ease: EASE }} className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Config</p>
                    <ConfigEditor skillId={skill.id} initial={skill.pluginConfig} onSaved={onChanged} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Restart banner ────────────────────────────────────────────────────────────

type RestartState = "pending" | "restarting" | "done" | "timeout";

function RestartBanner({
  state,
  onRestart,
  onDismiss,
}: {
  state: RestartState;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  const isDone    = state === "done";
  const isTimeout = state === "timeout";
  const isActive  = state === "restarting";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl shadow-black/20 text-sm backdrop-blur",
        isDone
          ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
          : isTimeout
            ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
            : "border-[var(--border-hi)] bg-[var(--surface)] text-[var(--text)]",
      )}
    >
        {isDone ? (
          <CheckCircle2Icon className="size-4 shrink-0" />
        ) : isTimeout ? (
          <AlertTriangleIcon className="size-4 shrink-0" />
        ) : isActive ? (
          <RefreshCwIcon className="size-4 shrink-0 animate-spin" />
        ) : (
          <WrenchIcon className="size-4 shrink-0 text-[var(--muted)]" />
        )}

        <span className="whitespace-nowrap">
          {isDone    ? "Gateway restarted"
           : isTimeout ? "Restart timed out — gateway may still be starting"
           : isActive  ? "Restarting gateway…"
                       : "Restart required to apply changes"}
        </span>

        {!isDone && !isTimeout && !isActive && (
          <button
            onClick={onRestart}
            className="ml-1 rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] px-3 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hi)] whitespace-nowrap"
          >
            Restart now
          </button>
        )}

        {!isActive && (
          <button
            onClick={onDismiss}
            className="ml-1 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            <XCircleIcon className="size-4" />
          </button>
        )}
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const { connected, rpc } = useGateway();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [restartState, setRestartState] = useState<RestartState | null>(null);
  const [lockedStatus, setLockedStatus] = useState<Record<string, SkillStatus>>({});
  const [pendingEnabled, setPendingEnabled] = useState<Record<string, boolean>>({});
  const sawDisconnectRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [installSessions, setInstallSessions] = useState<Record<string, { key: string; label: string }>>({});

  const fetchSkills = useCallback(async () => {
    try {
      let config = {};
      try { config = await rpc("config.get"); } catch {}
      const { skills } = await apiFetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      setSkills(skills);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  // Fetch skills when gateway connects (and on reconnect after restart).
  useEffect(() => {
    if (connected) fetchSkills();
  }, [connected, fetchSkills]);

  // Watch gateway connection for restart completion.
  useEffect(() => {
    if (restartState !== "restarting") {
      sawDisconnectRef.current = false;
      return;
    }
    if (!connected) sawDisconnectRef.current = true;
    if (connected && sawDisconnectRef.current) {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      setRestartState("done");
      sawDisconnectRef.current = false;
      setTimeout(() => {
        setRestartState(null);
        setLockedStatus({});
        setPendingEnabled({});
      }, 2_000);
    }
  }, [connected, restartState]);

  // Timeout if restart takes too long.
  useEffect(() => {
    if (restartState !== "restarting") return;
    restartTimeoutRef.current = setTimeout(() => setRestartState("timeout"), 60_000);
    return () => { if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current); };
  }, [restartState]);

  const handleToggled = useCallback((skillId: string, status: SkillStatus, newEnabled: boolean) => {
    setLockedStatus((prev) => ({ ...prev, [skillId]: status }));
    setPendingEnabled((prev) => ({ ...prev, [skillId]: newEnabled }));
    setRestartState((prev) => prev === null ? "pending" : prev);
  }, []);

  const handleRestart = useCallback(async () => {
    setRestartState("restarting");
    try { await apiFetch("/api/gateway/restart", { method: "POST" }); } catch {}
  }, []);

  const handleChanged = useCallback(() => {
    setRestartState((prev) => prev === null ? "pending" : prev);
    fetchSkills();
  }, [fetchSkills]);

  // For filtering/counts: lock status to pre-toggle value, keep enabled unchanged
  const skillsForFilter = skills.map((s) => ({
    ...s,
    ...(s.id in lockedStatus && { status: lockedStatus[s.id] }),
  }));

  // For display: also apply the new enabled state so the switch reflects the toggle
  const skillsForDisplay = skillsForFilter.map((s) => ({
    ...s,
    ...(s.id in pendingEnabled && { enabled: pendingEnabled[s.id] }),
  }));

  const total      = skillsForFilter.length;
  const ready      = skillsForFilter.filter((s) => !s.enabled && (s.status === "ready" || (s.status === "disabled" && hasAllDeps(s)))).length;
  const needsSetup = skillsForFilter.filter((s) => s.status === "missing-deps" || s.status === "needs-config").length;

  const counts: Record<FilterTab, number> = {
    all: total,
    enabled: skillsForFilter.filter((s) => s.enabled && s.status !== "missing-deps" && s.status !== "needs-config").length,
    ready,
    "needs-setup": needsSetup,
  };

  const filteredIds = new Set(filterSkills(skillsForFilter, activeFilter).map((s) => s.id));
  const filtered = skillsForDisplay.filter((s) => {
    // Keep skills with active install sessions visible so the dialog stays open
    if (!filteredIds.has(s.id) && !installSessions[s.id]?.key) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  return (
    <div className="h-[100svh] relative flex flex-col">
      <div className="flex-1 overflow-y-auto stable-gutter">
      <div className="relative bg-[var(--bg)] text-[var(--text)]">
        <div className="relative z-10 mx-auto px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* Toolbar */}
            <div className="mb-4 flex items-center gap-4">
              {/* Filter tabs */}
              {!loading && !error && total > 0 && (
                <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        activeFilter === f.id
                          ? "bg-[var(--surface-hi)] text-[var(--text)] shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--text-dim)]",
                      )}
                    >
                      {f.label}
                      {counts[f.id] > 0 && (
                        <span
                          className={cn(
                            "min-w-[16px] rounded-full px-1 py-px text-[10px] font-semibold tabular-nums text-center",
                            f.id === "needs-setup" && needsSetup > 0
                              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                              : "bg-[var(--border)] text-[var(--muted)]",
                          )}
                        >
                          {counts[f.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative ml-auto w-48">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-hi)] focus:outline-none transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                  >
                    <XCircleIcon className="size-3.5" />
                  </button>
                )}
              </div>
            </div>



            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-md border border-[var(--border-hi)] bg-[var(--surface)]"
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-5 py-4">
                <XCircleIcon className="size-4 shrink-0 text-[var(--status-error)]" />
                <p className="text-sm text-[var(--status-error-text)]">{error}</p>
              </div>
            )}

            {/* Skills grid */}
            {!loading && !error && (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((skill) => (
                      <motion.div
                        key={skill.id}
                        layout="position"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, layout: { duration: 0.25, ease: EASE } }}
                        className="will-change-[transform,opacity]"
                      >
                        <SkillCard skill={skill} onChanged={handleChanged} onToggled={handleToggled} installSessionKey={installSessions[skill.id]?.key} installSessionLabel={installSessions[skill.id]?.label} onInstallSessionStart={(skillId, key, label) => setInstallSessions((prev) => ({ ...prev, [skillId]: { key, label } }))} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {filtered.length === 0 && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center"
                    >
                      <p className="text-sm text-[var(--muted)]">
                        {total === 0
                          ? "No skills found in /app/skills/"
                          : search.trim()
                            ? `No skills match "${search}"`
                            : `No skills match "${FILTERS.find((f) => f.id === activeFilter)?.label}"`}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        </div>
      </div>
      </div>
      <AnimatePresence>
        {restartState !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <RestartBanner
              state={restartState}
              onRestart={handleRestart}
              onDismiss={() => setRestartState(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
