"use client";

// One row in the skills grid + its dialog. Renders the card, owns the dialog
// open state, and delegates per-skill optimistic toggle to the page via
// onToggled. Install state is discovered at the page level by scanning the
// session list — passed in here as installSessionKey/installSessionLabel.

import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import { RefreshCwIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { useEmojiColor } from "../_lib/emoji-color";
import { useSkillDialog } from "../../_context/skill-dialog-context";
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
  autoOpen,
}: {
  skill: Skill;
  onChanged: () => void;
  installSessionKey?: string;
  installSessionLabel?: string;
  autoOpen?: boolean;
}) {
  const emoji = skill.emoji ?? "🔧";
  const emojiColor = useEmojiColor(emoji);
  const lottieUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${[...emoji].map((c) => c.codePointAt(0)?.toString(16)).filter(Boolean).join("_")}/lottie.json`;
  const [open, setOpen] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [hasHoveredIcon, setHasHoveredIcon] = useState(false);
  const [animFailed, setAnimFailed] = useState(false);
  const [lottieData, setLottieData] = useState<object | null>(null);
  const [dialogAnimDone, setDialogAnimDone] = useState(false);

  useEffect(() => { if (!open) setDialogAnimDone(false); }, [open]);

  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);

  // Publish open state so the global install alert can suppress for this skill
  // while its dialog is showing (and re-appear when closed).
  const { setOpenSkillId } = useSkillDialog();
  useEffect(() => {
    if (!open) return;
    setOpenSkillId(skill.id);
    return () => setOpenSkillId(null);
  }, [open, skill.id, setOpenSkillId]);

  const needsLottie = hasHoveredIcon || open;
  useEffect(() => {
    if (!needsLottie || lottieData || animFailed) return;
    let cancelled = false;
    fetch(lottieUrl)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setLottieData(d); })
      .catch(() => { if (!cancelled) setAnimFailed(true); });
    return () => { cancelled = true; };
  }, [needsLottie, lottieData, animFailed, lottieUrl]);

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

  const installing = !!installSessionKey && !installResult;
  const dotColor = installing
    ? "bg-[var(--accent)]"
    : needsSetup
      ? "bg-[var(--status-warning-text)]"
      : "bg-[var(--status-success-text)]";

  const statusLabel = installing ? "Installing…" : needsSetup ? "Needs setup" : "Ready";

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex h-28 flex-row items-center gap-4 rounded-md border bg-[var(--surface)] px-4 py-3 cursor-pointer transition-colors duration-150 hover:border-[var(--accent)]/40",
          installing
            ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(var(--accent-rgb,99_102_241)/0.15)]"
            : "border-[var(--border)]",
        )}
      >
        {installing && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-md border border-[var(--accent)]/60 animate-pulse"
          />
        )}
        {/* Emoji app-icon tile */}
        <div
          className="group/icon relative grid aspect-square h-full shrink-0 place-items-center rounded-md overflow-hidden"
          onMouseEnter={() => setHasHoveredIcon(true)}
          style={{ background: emojiColor ? `linear-gradient(135deg, rgba(${emojiColor}, 0.7), rgba(${emojiColor}, 0.45))` : "var(--surface-hi)" }}
        >
          <span className={cn("block text-[2.5rem] leading-none pointer-events-none", lottieData && "group-hover/icon:opacity-0")} style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none", lineHeight: 1, transform: "translateY(0.06em)", filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}>{emoji}</span>
          {lottieData && (
            <div
              className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 group-hover/icon:opacity-100"
              style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
            >
              <Lottie animationData={lottieData} loop autoplay className="size-[2.875rem]" />
            </div>
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
          <div className={cn(
            "mt-2 flex items-center gap-1.5 text-[10px] font-medium",
            installing ? "text-[var(--accent)]" : "text-[var(--muted)]",
          )}>
            {installing ? (
              <RefreshCwIcon className="size-3 shrink-0 animate-spin" />
            ) : (
              <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
            )}
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
              <span className={cn("block text-[2.25rem] leading-none pointer-events-none", lottieData && !dialogAnimDone && "opacity-0")} style={{ fontFamily: "'Noto Color Emoji', sans-serif", userSelect: "none", lineHeight: 1, transform: "translateY(0.06em)", filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}>{emoji}</span>
              {lottieData && !dialogAnimDone && (
                <div
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                  style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
                >
                  <Lottie animationData={lottieData} loop={2} autoplay onComplete={() => setDialogAnimDone(true)} className="size-[2.625rem]" />
                </div>
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
                    <AskAiInstallButton skill={skill} onChanged={onChanged} initialSessionKey={installSessionKey} initialSessionLabel={installSessionLabel} />
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
