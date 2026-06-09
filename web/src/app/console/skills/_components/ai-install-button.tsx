"use client";

// "Install with OpenClaw" — kicks off a background chat session that asks the
// agent to install a skill's missing deps. We watch the session for STATUS:
// lines and INSTALL_OK/INSTALL_FAIL/INSTALL_ATTENTION sentinels, render a live
// transcript, and surface a final pass/fail tile.
//
// The parent SkillsPage discovers in-progress installs by scanning the
// session list (".tmp set up <skillId>" label) and feeds the key in via
// initialSessionKey — so an install survives both modal close+reopen and a
// full page refresh. The .tmp session is auto-deleted on completion (see
// sessions-context); local state below latches the result so the tile sticks.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  RefreshCwIcon,
  SparklesIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { CornerTab } from "@/components/ui/corner-tab";
import { useChat } from "../../_context/chat-context";
import { useSessions } from "../../_context/sessions-context";
import { MessageList } from "../../_components/chat-components";
import { usePendingPrompts, buildPromptReplyHiddenPrefix } from "../../_components/prompt-listener";
import { PromptForm, PromptDescription } from "../../_components/prompt-form";
import {
  detectResult,
  latestStatus,
  stripMarkers,
  useSessionObserver,
  INSTALL_LABEL_PREFIX,
  type InstallResult,
} from "../_lib/install-helpers";
import type { Skill } from "../_lib/skills";

export function AskAiInstallButton({
  skill,
  onChanged,
  initialSessionKey,
  initialSessionLabel,
}: {
  skill: Skill;
  onChanged: () => void;
  initialSessionKey?: string;
  initialSessionLabel?: string;
}) {
  const { sendToSession } = useChat();
  const { createSession, setActiveSessionKey, deleteSession } = useSessions();
  const router = useRouter();
  const [sessionKey, setSessionKey] = useState<string | null>(initialSessionKey ?? null);
  const [sessionLabel, setSessionLabel] = useState<string | null>(initialSessionLabel ?? null);
  const [expanded, setExpanded] = useState(false);
  const [latchedResult, setLatchedResult] = useState<InstallResult>(null);
  const [logReady, setLogReady] = useState(false);
  const { messages, isThinking } = useSessionObserver(sessionKey);

  // Hydrate from props when an install session is discovered after mount —
  // e.g. on a page refresh, sessions.list arrives a moment later and the
  // parent recomputes installSessionKey/Label from it.
  useEffect(() => {
    if (initialSessionKey && !sessionKey) {
      setSessionKey(initialSessionKey);
      setSessionLabel(initialSessionLabel ?? null);
    }
  }, [initialSessionKey, initialSessionLabel, sessionKey]);

  // Pre-render log content once idle so expand animation doesn't lag
  useEffect(() => {
    if (!sessionKey || logReady) return;
    const id = (window.requestIdleCallback ?? setTimeout)(() => setLogReady(true));
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, [sessionKey, logReady]);

  const liveResult = detectResult(messages);
  const result = latchedResult ?? liveResult;
  const latestLine = latestStatus(messages);
  // Hide the kickoff message + plain user replies, but keep prompt-reply
  // messages — MessageList uses them to mark prompts as answered.
  const visibleMessages = messages.filter((m) => m.role !== "user" || !!m.promptReplyId);

  const pendingPrompts = usePendingPrompts(messages);
  const currentPrompt = pendingPrompts.find((p) => p.answeredWith === undefined) ?? null;
  const handlePromptReply = (id: string, displayValue: string, structured: unknown) => {
    if (!sessionKey) return;
    sendToSession(sessionKey, displayValue, buildPromptReplyHiddenPrefix(id, structured));
  };

  // Strip STATUS lines and codewords from displayed messages
  const displayMessages = visibleMessages
    .map((m) => {
      if (m.role !== "assistant") return m;
      const cleaned = stripMarkers(m.content);
      if (cleaned === m.content) return m;
      return { ...m, content: cleaned };
    })
    .filter((m) => m.role !== "assistant" || m.content.length > 0);

  // Latch the result so it survives session cleanup
  useEffect(() => {
    if (liveResult && !latchedResult) setLatchedResult(liveResult);
  }, [liveResult, latchedResult]);

  // Refresh skills list on completion
  useEffect(() => {
    if (result) onChanged();
  }, [result, onChanged]);

  const handleClick = async () => {
    const missingBins = [...skill.missingBins, ...(skill.missingAnyBins ?? [])];
    const missingEnv = skill.missingEnv ?? [];
    const missingConfig = skill.missingConfig ?? [];
    const label = `${INSTALL_LABEL_PREFIX}${skill.id}`;
    const key = await createSession(label, false);
    setSessionKey(key);
    setSessionLabel(label);
    const tasks = [
      missingBins.length > 0 && `install these binaries (and only these — the rest are already on PATH): ${missingBins.join(", ")}`,
      missingEnv.length > 0 && `collect these env vars from the user via rele prompts (never prose), then save them to config: ${missingEnv.join(", ")}`,
      missingConfig.length > 0 && `collect these config values from the user via rele prompts, then write to the matching config path: ${missingConfig.join(", ")}`,
    ].filter(Boolean).join(". ");
    sendToSession(
      key,
      `Set up "${skill.name}". Do exactly this and nothing else: ${tasks}. Don't reinstall, re-check, or touch anything not in that list — the other prerequisites are already satisfied. Check /app/skills/${skill.id}/SKILL.md for install instructions for the missing binaries. For env/config prompts, see your rele skill for the syntax. Before each action send "STATUS: <1-5 words>" (e.g. "STATUS: Installing via apt", "STATUS: Asking for API key"). End final message with INSTALL_OK once *everything* in the list above is done — binaries installed AND env vars/config saved — not just the binary part. Use INSTALL_FAIL if you can't complete it, or INSTALL_ATTENTION if it needs a human to take over.`,
    );
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionKey) return;
    const key = sessionKey;
    setSessionKey(null);
    setSessionLabel(null);
    setExpanded(false);
    try { await deleteSession(key); } catch {}
  };

  const goToSession = () => {
    if (!sessionKey) return;
    setActiveSessionKey(sessionKey);
    router.push("/console/chat");
  };

  const hasMissing =
    skill.missingBins.length > 0 ||
    (skill.missingAnyBins ?? []).length > 0 ||
    (skill.missingEnv ?? []).length > 0 ||
    (skill.missingConfig ?? []).length > 0;
  const stateKey = !sessionKey ? "idle" : result ? "result" : "running";

  // Hide entirely when idle with no missing deps
  if (!sessionKey && !hasMissing) return null;

  const showInlinePrompt = !!currentPrompt && !expanded && !!sessionKey;

  const resultConfig = result && {
    ok:        { icon: CheckCircle2Icon,  label: "Installed successfully", bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
    fail:      { icon: XCircleIcon,       label: "Installation failed",    bg: "bg-[var(--status-error-bg)]",   text: "text-[var(--status-error-text)]" },
    attention: { icon: AlertTriangleIcon, label: "Needs attention",        bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning-text)]" },
  }[result];

  return (
    <div className="flex flex-col gap-2">
      {stateKey === "idle" && (
        <button
          onClick={handleClick}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white transition-all hover:bg-[var(--accent-dim)] active:scale-[0.98]"
        >
          <SparklesIcon className="size-3.5" />
          Install with OpenClaw
        </button>
      )}

      {stateKey === "result" && resultConfig && (
        <div
          onClick={displayMessages.length > 0 ? () => setExpanded((v) => !v) : undefined}
          className={cn("flex items-center gap-2 rounded-lg px-3 py-2", resultConfig.bg, displayMessages.length > 0 && "cursor-pointer")}
        >
          <resultConfig.icon className={cn("size-3.5 shrink-0", resultConfig.text)} />
          <span className={cn("flex-1 text-xs font-medium", resultConfig.text)}>{resultConfig.label}</span>
          {displayMessages.length > 0 && (
            <ChevronDownIcon className={cn("size-3.5 transition-transform", resultConfig.text, expanded && "rotate-180")} />
          )}
        </div>
      )}

      {stateKey === "running" && (
        <div className="flex items-stretch gap-2">
          <div
            onClick={displayMessages.length > 0 ? () => setExpanded((v) => !v) : undefined}
            className={cn("flex flex-1 min-w-0 items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2", displayMessages.length > 0 && "cursor-pointer")}
          >
            <RefreshCwIcon className="size-3.5 shrink-0 animate-spin text-[var(--accent)]" />
            <span className="flex-1 min-w-0 truncate text-xs text-[var(--text-dim)]">
              {latestLine ?? "Installing…"}
            </span>
            {displayMessages.length > 0 && (
              <ChevronDownIcon className={cn("size-3.5 text-[var(--muted)] transition-transform", expanded && "rotate-180")} />
            )}
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 text-xs font-medium text-[var(--status-error-text)] transition-colors hover:bg-[var(--status-error-border)]"
          >
            <XIcon className="size-3.5" />
            Cancel
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showInlinePrompt && currentPrompt && (
          <motion.div
            key={`inline-prompt:${currentPrompt.spec.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--surface)] p-3">
              {currentPrompt.spec.title && (
                <div className="mb-1 text-xs font-medium text-[var(--text)]">
                  {currentPrompt.spec.title}
                </div>
              )}
              {currentPrompt.spec.description && (
                <PromptDescription className="mb-2 text-[11px] text-[var(--muted)]">
                  {currentPrompt.spec.description}
                </PromptDescription>
              )}
              <PromptForm
                spec={currentPrompt.spec}
                onSubmit={(display, structured) => handlePromptReply(currentPrompt.spec.id, display, structured)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {expanded && logReady && sessionKey && (
          <motion.div
            key="log"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="relative rounded-lg border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
              <FadeScroll className="rounded-lg" innerClassName="h-60 p-3" pinToBottom={!result}>
                <div className="flex flex-col gap-3 min-w-0 break-words overflow-hidden">
                  <MessageList messages={displayMessages} compact onPromptReply={handlePromptReply} />
                  {!result && isThinking && <TypingIndicator />}
                </div>
              </FadeScroll>
              {sessionLabel && (
                <CornerTab onClick={goToSession}>{sessionLabel}</CornerTab>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
