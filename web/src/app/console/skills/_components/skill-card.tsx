"use client";

// One row in the skills grid + its dialog. Renders the card, owns the dialog
// open state, and delegates per-skill optimistic toggle to the page via
// onToggled. Install state lives at the page level too — passed in here as
// installSessionKey/installSessionLabel and bubbled back up via
// onInstallSessionStart.

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { useEmojiColor } from "../_lib/emoji-color";
import { type Skill } from "../_lib/skills";
import { detectResult, useSessionObserver } from "../_lib/install-helpers";
import { InstallButton } from "./install-button";
import { AskAiInstallButton } from "./ai-install-button";
import { ConfigEditor } from "./config-editor";

export const SkillCard = memo(function SkillCard({
  skill,
  onChanged,
  installSessionKey,
  installSessionLabel,
  onInstallSessionStart,
}: {
  skill: Skill;
  onChanged: () => void;
  installSessionKey?: string;
  installSessionLabel?: string;
  onInstallSessionStart: (skillId: string, sessionKey: string, label: string) => void;
}) {
  const emoji = skill.emoji ?? "🔧";
  const emojiColor = useEmojiColor(emoji);
  const animatedEmojiUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${[...emoji].map((c) => c.codePointAt(0)?.toString(16)).filter(Boolean).join("_")}/512.gif`;
  const [open, setOpen] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [hasHoveredIcon, setHasHoveredIcon] = useState(false);
  const [animFailed, setAnimFailed] = useState(false);
  const [animLoaded, setAnimLoaded] = useState(false);

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

  const dotColor = needsSetup
    ? "bg-[var(--status-warning-text)]"
    : "bg-[var(--status-success-text)]";

  const statusLabel = needsSetup ? "Needs setup" : "Ready";

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="group relative flex h-28 flex-row items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 cursor-pointer transition-colors duration-150 hover:border-[var(--accent)]/40"
      >
        {/* Emoji app-icon tile */}
        <div
          className="group/icon relative grid aspect-square h-full shrink-0 place-items-center rounded-md overflow-hidden"
          onMouseEnter={() => setHasHoveredIcon(true)}
          style={{ background: emojiColor ? `linear-gradient(135deg, rgba(${emojiColor}, 0.7), rgba(${emojiColor}, 0.45))` : "var(--surface-hi)" }}
        >
          <span className={cn("block text-[2.5rem] leading-none pointer-events-none transition-opacity", animLoaded && "group-hover/icon:opacity-0")} style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none", lineHeight: 1, transform: "translateY(0.06em)", filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}>{emoji}</span>
          {hasHoveredIcon && !animFailed && (
            <img
              src={animatedEmojiUrl}
              alt=""
              aria-hidden
              onLoad={() => setAnimLoaded(true)}
              onError={() => setAnimFailed(true)}
              className={cn("pointer-events-none absolute inset-0 m-auto size-[3.25rem] object-contain opacity-0 transition-opacity", animLoaded && "group-hover/icon:opacity-100")}
              style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 min-w-0 flex-col">
          <p className="text-sm font-medium text-[var(--text)] leading-snug truncate group-hover:text-[var(--accent)] transition-colors">
            {skill.name}
          </p>
          {skill.description && (
            <p className="mt-1 flex-1 text-[11px] text-[var(--text-dim)] leading-relaxed line-clamp-2">
              {skill.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
            <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
            {statusLabel}
          </div>
        </div>
      </div>

      {open && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90svh] gap-0 !flex !flex-col overflow-hidden p-0 [&>*]:min-w-0">

          {/* Header */}
          <div className="relative flex items-center gap-4 border-b border-[var(--border)] px-5 py-4 shrink-0">
            <div
              className="relative grid size-14 shrink-0 place-items-center rounded-md overflow-hidden"
              style={{ background: emojiColor ? `linear-gradient(135deg, rgba(${emojiColor}, 0.7), rgba(${emojiColor}, 0.45))` : "var(--surface-hi)" }}
            >
              <span className={cn("block text-[2.25rem] leading-none pointer-events-none transition-opacity", animLoaded && "opacity-0")} style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none", lineHeight: 1, transform: "translateY(0.06em)", filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}>{emoji}</span>
              {!animFailed && (
                <img
                  src={animatedEmojiUrl}
                  alt=""
                  aria-hidden
                  onLoad={() => setAnimLoaded(true)}
                  onError={() => setAnimFailed(true)}
                  className={cn("pointer-events-none absolute inset-0 m-auto size-12 object-contain transition-opacity", animLoaded ? "opacity-100" : "opacity-0")}
                  style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
                />
              )}
            </div>
            <div className="flex flex-1 min-w-0 flex-col gap-1.5">
              <DialogTitle className="text-base font-semibold leading-tight text-[var(--text)]">
                {skill.name}
              </DialogTitle>
              <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
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

          {/* Details */}
          {hasDetails && (
            <div className="min-w-0">
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
