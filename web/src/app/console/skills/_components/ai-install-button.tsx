"use client";

// "Install with OpenClaw" — kicks off a background chat session that asks the
// agent to install a skill's missing deps. We watch the session for STATUS:
// lines and INSTALL_OK/INSTALL_FAIL/INSTALL_ATTENTION sentinels, render a live
// transcript, and surface a final pass/fail tile.
//
// Session state is owned by the parent SkillsPage (via initialSessionKey /
// onSessionStart) so logs survive modal close+reopen even though the .tmp
// session is auto-deleted on completion (see sessions-context).

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
} from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { CornerTab } from "@/components/ui/corner-tab";
import { useChat } from "../../_context/chat-context";
import { useSessions } from "../../_context/sessions-context";
import { MessageRow } from "../../_components/chat-components";
import {
  detectResult,
  latestStatus,
  stripMarkers,
  useSessionObserver,
  type InstallResult,
} from "../_lib/install-helpers";
import type { Skill } from "../_lib/skills";

export function AskAiInstallButton({
  skill,
  onChanged,
  initialSessionKey,
  initialSessionLabel,
  onSessionStart,
}: {
  skill: Skill;
  onChanged: () => void;
  initialSessionKey?: string;
  initialSessionLabel?: string;
  onSessionStart: (sessionKey: string, label: string) => void;
}) {
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
    const id = (window.requestIdleCallback ?? setTimeout)(() => setLogReady(true));
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, [sessionKey, logReady]);

  const liveResult = detectResult(messages);
  const result = latchedResult ?? liveResult;
  const latestLine = latestStatus(messages);
  const visibleMessages = messages.filter((m) => m.role !== "user");

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
          ok:        { icon: CheckCircle2Icon,  label: "Installed successfully", border: "border-[var(--status-success-border)]", bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
          fail:      { icon: XCircleIcon,       label: "Installation failed",    border: "border-[var(--status-error-border)]",   bg: "bg-[var(--status-error-bg)]",   text: "text-[var(--status-error-text)]" },
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
            <div
              onClick={displayMessages.length > 0 ? () => setExpanded((v) => !v) : undefined}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2", config.bg, displayMessages.length > 0 && "cursor-pointer")}
            >
              <Icon className={cn("size-3.5 shrink-0", config.text)} />
              <span className={cn("flex-1 text-xs font-medium", config.text)}>{config.label}</span>
              {displayMessages.length > 0 && (
                <ChevronDownIcon className={cn("size-3.5 transition-transform", config.text, expanded && "rotate-180")} />
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
          <div
            onClick={displayMessages.length > 0 ? () => setExpanded((v) => !v) : undefined}
            className={cn("flex items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2", displayMessages.length > 0 && "cursor-pointer")}
          >
            <RefreshCwIcon className="size-3.5 shrink-0 animate-spin text-[var(--accent)]" />
            <span className="flex-1 min-w-0 truncate text-xs text-[var(--text-dim)]">
              {latestLine ?? "Installing…"}
            </span>
            {displayMessages.length > 0 && (
              <ChevronDownIcon className={cn("size-3.5 text-[var(--muted)] transition-transform", expanded && "rotate-180")} />
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
