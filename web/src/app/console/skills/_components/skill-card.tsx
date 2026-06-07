"use client";

// One row in the skills grid + its dialog. Renders the card, owns the dialog
// open state, and delegates per-skill optimistic toggle to the page via
// onToggled. Install state lives at the page level too — passed in here as
// installSessionKey/installSessionLabel and bubbled back up via
// onInstallSessionStart.

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { useEmojiColor } from "../_lib/emoji-color";
import { apiFetch, type Skill, type SkillStatus } from "../_lib/skills";
import { detectResult, useSessionObserver } from "../_lib/install-helpers";
import { InstallButton } from "./install-button";
import { AskAiInstallButton } from "./ai-install-button";
import { ConfigEditor } from "./config-editor";

export const SkillCard = memo(function SkillCard({
  skill,
  onChanged,
  onToggled,
  installSessionKey,
  installSessionLabel,
  onInstallSessionStart,
}: {
  skill: Skill;
  onChanged: () => void;
  onToggled: (skillId: string, lockedStatus: SkillStatus, newEnabled: boolean) => void;
  installSessionKey?: string;
  installSessionLabel?: string;
  onInstallSessionStart: (skillId: string, sessionKey: string, label: string) => void;
}) {
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
  const hasDetails =
    skill.pluginConfig !== null ||
    skill.missingBins.length > 0 ||
    missingAnyBins.length > 0 ||
    missingEnv.length > 0 ||
    skill.missingConfig.length > 0 ||
    skill.installEntries.length > 0 ||
    !!installSessionKey;

  const dotColor =
    skill.status === "ready" ? "bg-[var(--status-success-text)]"
    : needsSetup              ? "bg-[var(--status-warning-text)]"
                              : "bg-[var(--border-hi)]";

  const statusLabel =
    skill.status === "ready"          ? "Active"
    : skill.status === "missing-deps" ? "Missing deps"
    : skill.status === "needs-config" ? "Needs config"
                                      : "Disabled";

  const statusBadgeClass =
    skill.status === "ready" ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)] ring-1 ring-[var(--status-success)]"
    : needsSetup              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] ring-1 ring-[var(--status-warning)]"
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
          className="relative flex w-24 shrink-0 items-center justify-center overflow-hidden "
          style={{ background: emojiColor ? `linear-gradient(145deg, rgba(${emojiColor}, 0.5), rgba(${emojiColor}, 0.3))` : "var(--surface-hi)" }}
        >
          <span className="relative text-[3.5rem] leading-none opacity-85 pointer-events-none" style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none", filter: "drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 2px rgba(0,0,0,0.25))" }}>{skill.emoji ?? "🔧"}</span>
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

      {open && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90svh] gap-0 !flex !flex-col overflow-hidden p-0 [&>*]:min-w-0">

          {/* Hero header with gradient */}
          <div
            className="relative overflow-hidden rounded-t-lg px-5 pt-5 pb-4 shrink-0"
            style={{ background: emojiColor ? `linear-gradient(145deg, rgba(${emojiColor}, 0.6), rgba(${emojiColor}, 0.35))` : "var(--surface-hi)" }}
          >
            {/* Dark saturated wash behind text for contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" style={{ backdropFilter: "saturate(1.5)" }} />
            <span className="absolute -right-4 -top-4 text-[5rem] leading-none opacity-50 pointer-events-none" style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none", filter: "drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 3px 3px rgba(0,0,0,0.25))" }}>{skill.emoji ?? "🔧"}</span>
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


          <FadeScroll
            className="flex-1 min-h-0 w-full"
            innerClassName="px-5 pb-5 pt-2 flex flex-col h-auto max-h-[calc(90svh-120px)]"
          >
          {skill.description && (
            <p className="text-xs text-[var(--text-dim)] leading-relaxed mb-5">
              {skill.description}
            </p>
          )}

          {/* Enable row — hidden when deps are missing (user needs to install first) */}
          {skill.status !== "missing-deps" && (
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
          )}

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
          </FadeScroll>

        </DialogContent>
      </Dialog>}
    </>
  );
});
