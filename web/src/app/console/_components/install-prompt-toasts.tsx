"use client";

// Global top-right alerts shown while a skill install is in progress. One
// card per in-flight ".tmp set up <skillId>" session. Persistent (not gated
// on whether the agent currently has a pending prompt) so the user always
// knows an install is happening. If the agent does have an open prompt the
// card highlights and shows it inline.
//
// Suppressed on /console/skills (the page itself surfaces the install state
// in-card) and on /console/chat when the focused session is the install one.

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCwIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useChat } from "../_context/chat-context";
import { useSessions } from "../_context/sessions-context";
import { useSkillDialog } from "../_context/skill-dialog-context";
import {
  detectResult,
  latestStatus,
  useSessionObserver,
  INSTALL_LABEL_PREFIX,
} from "../skills/_lib/install-helpers";
import { SkillIcon } from "../skills/_components/skill-icon";
import type { Skill } from "../skills/_lib/skills";
import { usePendingPrompts, buildPromptReplyHiddenPrefix } from "./prompt-listener";
import { PromptForm, PromptDescription } from "./prompt-form";

const SKILLS_CACHE_KEY = "skills-page-cache-v1";

// Pull cached skills from the skills page's sessionStorage so we can render
// emoji + name without re-fetching. If the cache isn't there yet we fall back
// to the raw skillId.
function useCachedSkills(): Record<string, Skill> {
  const [map, setMap] = useState<Record<string, Skill>>({});
  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem(SKILLS_CACHE_KEY);
        if (!raw) return;
        const skills = JSON.parse(raw) as Skill[];
        const out: Record<string, Skill> = {};
        for (const s of skills) out[s.id] = s;
        setMap(out);
      } catch {}
    };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === SKILLS_CACHE_KEY) read(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return map;
}

export function InstallPromptToasts() {
  const { sessions, activeSessionKey } = useSessions();
  const { openSkillId } = useSkillDialog();
  const router = useRouter();
  const pathname = usePathname();
  const skills = useCachedSkills();

  const installSessions = sessions.filter((s) =>
    s.displayName.startsWith(INSTALL_LABEL_PREFIX),
  );

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {installSessions.map((s) => {
          const skillId = s.displayName.slice(INSTALL_LABEL_PREFIX.length);
          // Suppress only when this skill's own dialog is open (the inline
          // install panel already shows the same info) or when the chat page
          // is focused on this install's session.
          const suppress =
            openSkillId === skillId ||
            (pathname === "/console/chat" && activeSessionKey === s.key);
          if (suppress) return null;
          return (
            <InstallAlert
              key={s.key}
              sessionKey={s.key}
              skill={skills[skillId] ?? null}
              skillId={skillId}
              onOpen={() => router.push(`/console/skills?skill=${encodeURIComponent(skillId)}`)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function InstallAlert({
  sessionKey,
  skill,
  skillId,
  onOpen,
}: {
  sessionKey: string;
  skill: Skill | null;
  skillId: string;
  onOpen: () => void;
}) {
  const { messages } = useSessionObserver(sessionKey);
  const { sendToSession } = useChat();
  const prompts = usePendingPrompts(messages);
  const pending = prompts.find((p) => p.answeredWith === undefined);
  const result = detectResult(messages);
  const status = latestStatus(messages);
  const name = skill?.name ?? skillId;
  const emoji = skill?.emoji ?? "🔧";

  // Hide once the install resolves successfully — failure/attention still
  // surface so the user can take action.
  if (result === "ok") return null;

  const subline = pending
    ? "Needs your input"
    : status ?? (result === "fail" ? "Installation failed" : result === "attention" ? "Needs attention" : "Installing…");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.96 }}
      transition={{ duration: 0.22, ease: EASE }}
      className={cn(
        "pointer-events-auto w-[340px] overflow-hidden rounded-xl border bg-[var(--surface)] shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-sm",
        pending ? "border-[var(--accent)]/50" : "border-[var(--border)]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hi)]"
      >
        <SkillIcon emoji={emoji} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--text)]">
            Setting up {name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            {!result && (
              <RefreshCwIcon className="size-3 shrink-0 animate-spin text-[var(--accent)]" />
            )}
            <span className="truncate">{subline}</span>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
          Open →
        </span>
      </button>

      <AnimatePresence initial={false}>
        {pending && (
          <motion.div
            key={pending.spec.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-[var(--border)] p-3">
              {pending.spec.title && (
                <div className="mb-1 text-xs font-medium text-[var(--text)]">
                  {pending.spec.title}
                </div>
              )}
              {pending.spec.description && (
                <PromptDescription className="mb-2 text-[11px] text-[var(--muted)]">
                  {pending.spec.description}
                </PromptDescription>
              )}
              <PromptForm
                spec={pending.spec}
                onSubmit={(display, structured) =>
                  sendToSession(
                    sessionKey,
                    display,
                    buildPromptReplyHiddenPrefix(pending.spec.id, structured),
                  )
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
