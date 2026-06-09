"use client";

// Per-channel editor dialog. Same dialog shell + animated-emoji header as the
// skills dialog, with tabs for Setup / Advanced / Pair.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import Lottie from "lottie-react";
import { motion } from "framer-motion";
import { ExternalLinkIcon, Trash2Icon, Loader2Icon, QrCodeIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useEmojiColor } from "../../skills/_lib/emoji-color";
import { useGateway } from "../../_context/gateway-context";
import { type ChannelDef } from "../_lib/channels";
import {
  getSchema,
  pickChannelSchema,
  setChannelSlice,
} from "../_lib/config-io";
import { SchemaForm } from "./schema-form";

type SaveState = "idle" | "saving" | "saved" | { error: string };

export function ChannelDialog({
  def,
  initialSlice,
  open,
  onOpenChange,
  onSaved,
}: {
  def: ChannelDef | null;
  initialSlice: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { rpc } = useGateway();
  const [tab, setTab] = useState<"setup" | "advanced" | "pair">("setup");
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [dialogAnimDone, setDialogAnimDone] = useState(false);
  const [lottieData, setLottieData] = useState<object | null>(null);
  const [animFailed, setAnimFailed] = useState(false);

  const emoji = def?.glyph ?? "💬";
  const emojiColor = useEmojiColor(emoji);
  const lottieUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${[...emoji].map((c) => c.codePointAt(0)?.toString(16)).filter(Boolean).join("_")}/lottie.json`;

  useEffect(() => { if (!open) setDialogAnimDone(false); }, [open]);

  useEffect(() => {
    if (!def) return;
    setDraft(initialSlice ?? { enabled: true });
    setTab(def.needsPairing ? "pair" : "setup");
    setSave("idle");
    setLottieData(null);
    setAnimFailed(false);
  }, [def, initialSlice]);

  useEffect(() => {
    if (!open || !def) return;
    let cancelled = false;
    fetch(lottieUrl)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setLottieData(d); })
      .catch(() => { if (!cancelled) setAnimFailed(true); });
    return () => { cancelled = true; };
  }, [open, def, lottieUrl]);

  useEffect(() => {
    if (!open || !def) return;
    let cancelled = false;
    getSchema(rpc).then((full) => {
      if (cancelled) return;
      setSchema(pickChannelSchema(full, def.id));
    });
    return () => { cancelled = true; };
  }, [open, def, rpc]);

  const enabled = draft.enabled !== false;
  const setEnabled = (v: boolean) => setDraft((d) => ({ ...d, enabled: v }));

  const handleSave = useCallback(async () => {
    if (!def) return;
    setSave("saving");
    try {
      await setChannelSlice(rpc, def.id, draft);
      setSave("saved");
      onSaved();
      setTimeout(() => setSave("idle"), 1500);
    } catch (e) {
      setSave({ error: e instanceof Error ? e.message : "Save failed" });
    }
  }, [def, draft, rpc, onSaved]);

  const handleRemove = useCallback(async () => {
    if (!def) return;
    if (!confirm(`Remove ${def.label} configuration entirely?`)) return;
    setSave("saving");
    try {
      await setChannelSlice(rpc, def.id, null);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setSave({ error: e instanceof Error ? e.message : "Remove failed" });
    }
  }, [def, rpc, onSaved, onOpenChange]);

  const tabs = useMemo(() => {
    if (!def) return [] as { id: "pair" | "setup" | "advanced"; label: string }[];
    const list: { id: "pair" | "setup" | "advanced"; label: string }[] = [];
    if (def.needsPairing) list.push({ id: "pair", label: "Pair" });
    list.push({ id: "setup", label: "Setup" });
    list.push({ id: "advanced", label: "Advanced" });
    return list;
  }, [def]);

  if (!def) return null;

  let statusLabel: string;
  let dotClass: string;
  if (!initialSlice) {
    statusLabel = "Available";
    dotClass = "bg-[var(--muted)]/40";
  } else if (!enabled) {
    statusLabel = "Disabled";
    dotClass = "bg-[var(--muted)]/60";
  } else {
    statusLabel = "Enabled";
    dotClass = "bg-[var(--status-success-text)]";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[92vw] gap-0 !flex !flex-col overflow-hidden p-0 [&>*]:min-w-0">
        {/* Header */}
        <div className="relative flex items-center gap-4 border-b border-[var(--border)] px-5 py-4 shrink-0">
          <div
            className="relative grid size-14 shrink-0 place-items-center rounded-md overflow-hidden"
            style={{
              background: emojiColor
                ? `linear-gradient(135deg, rgba(${emojiColor}, 0.7), rgba(${emojiColor}, 0.45))`
                : "var(--surface-hi)",
            }}
          >
            <span
              className={cn(
                "block text-[2.25rem] leading-none pointer-events-none",
                lottieData && !dialogAnimDone && "opacity-0",
              )}
              style={{
                fontFamily: "'Noto Color Emoji', sans-serif",
                userSelect: "none",
                lineHeight: 1,
                transform: "translateY(0.06em)",
                filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
              }}
            >
              {emoji}
            </span>
            {lottieData && !dialogAnimDone && !animFailed && (
              <div
                className="pointer-events-none absolute inset-0 grid place-items-center"
                style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
              >
                <Lottie
                  animationData={lottieData}
                  loop={2}
                  autoplay
                  onComplete={() => setDialogAnimDone(true)}
                  className="size-[2.625rem]"
                />
              </div>
            )}
          </div>
          <div className="flex flex-1 min-w-0 flex-col gap-1.5">
            <DialogTitle className="text-base font-semibold leading-tight text-[var(--text)]">
              {def.label}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
                <span className={cn("size-1.5 rounded-full shrink-0", dotClass)} />
                {statusLabel}
              </span>
              <a
                href={def.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:underline"
              >
                Docs <ExternalLinkIcon className="size-3" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-8">
            <span className="text-[11px] text-[var(--text-dim)]">Enabled</span>
            <Switch size="sm" checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--border)] px-5 py-2 shrink-0">
          <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 w-fit">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  tab === t.id
                    ? "bg-[var(--surface-hi)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--text-dim)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatedBody maxHeightVh={0.9} maxHeightOffsetPx={200} minHeight={480}>
          {(contentRef) => (
            <FadeScroll className="h-full" innerClassName="px-5 pb-5 pt-4 h-full" fadeFrom="from-[var(--popover)]">
              <div ref={contentRef}>
                {tab === "pair" && <PairingPanel def={def} />}
                {tab === "setup" && <SetupTab def={def} schema={schema} draft={draft} setDraft={setDraft} />}
                {tab === "advanced" && (
                  <SchemaForm
                    schema={schema as never}
                    value={draft}
                    onChange={setDraft}
                    excludeKeys={["enabled", ...def.setupFields]}
                  />
                )}
              </div>
            </FadeScroll>
          )}
        </AnimatedBody>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3 shrink-0">
          {initialSlice ? (
            <Button variant="ghost" size="sm" onClick={handleRemove} className="text-[var(--status-error)]">
              <Trash2Icon className="size-3.5" /> Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {typeof save === "object" && (
              <span className="text-[11px] text-[var(--status-error)]">{save.error}</span>
            )}
            {save === "saved" && (
              <span className="text-[11px] text-[var(--status-success-text)]">Saved</span>
            )}
            <Button size="sm" onClick={handleSave} disabled={save === "saving"}>
              {save === "saving" && <Loader2Icon className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SetupTab({
  def,
  schema,
  draft,
  setDraft,
}: {
  def: ChannelDef;
  schema: Record<string, unknown> | null;
  draft: Record<string, unknown>;
  setDraft: (d: Record<string, unknown>) => void;
}) {
  if (def.setupFields.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        {def.setupHint ?? "Nothing to configure here — toggle Enabled and Save."}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {def.setupHint && (
        <p className="text-sm text-[var(--text-dim)] leading-relaxed">{def.setupHint}</p>
      )}
      {def.setupSteps && def.setupSteps.length > 0 && (
        <ol className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          {def.setupSteps.map((step, i) => (
            <li key={i} className="flex gap-3 text-xs text-[var(--text-dim)] leading-relaxed">
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: `${def.brand}22`, color: def.brand }}
              >
                {i + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: renderInlineCode(step) }} />
            </li>
          ))}
        </ol>
      )}
      <SchemaForm
        schema={schema as never}
        value={draft}
        onChange={setDraft}
        onlyKeys={def.setupFields}
        fieldHints={def.setupFieldHints}
      />
    </div>
  );
}

// Cheap inline `code` rendering for setup steps. Escapes HTML, then turns
// `…` runs into <code>…</code>. Used only with hand-authored strings from
// the channel catalog, so we don't need a full markdown pipeline.
function renderInlineCode(s: string): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-[var(--bg)] border border-[var(--border)] px-1 py-px text-[10px] font-mono text-[var(--text)]">$1</code>',
  );
}

// Smoothly animates the dialog body between content sizes. The caller's
// render-prop wires the supplied ref to the *real* content element — typically
// a <div> directly inside FadeScroll — so we measure the natural content
// height regardless of how many scroll/fade wrappers sit between us and it.
// Caps at `maxHeight`; FadeScroll handles overflow + hides scrollbars.
// Animates the body height to match its measured content. Subtleties:
//   1. First measurement is in useLayoutEffect (pre-paint) and the motion.div
//      uses initial={false} — Framer can't tween from "auto" → number, so
//      without this we'd snap on first open.
//   2. We compute the cap (maxHeight) in *pixels* and clamp the animated
//      target ourselves. If we relied on CSS max-height alone, Framer would
//      tween to e.g. 1500px while CSS clipped the rendered box at 600px,
//      producing what looks like an instant jump.
//   3. We clamp upward to `minHeight` so short tabs don't dip below it during
//      a content swap.
function AnimatedBody({
  children,
  maxHeightVh,
  maxHeightOffsetPx,
  minHeight = 0,
}: {
  children: (ref: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
  maxHeightVh: number;          // e.g. 0.9 for 90svh
  maxHeightOffsetPx: number;    // subtract this many px (header + tabs + footer)
  minHeight?: number;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [maxPx, setMaxPx] = useState(() =>
    typeof window === "undefined" ? 600 : window.innerHeight * maxHeightVh - maxHeightOffsetPx,
  );

  useLayoutEffect(() => {
    const recomputeMax = () => setMaxPx(window.innerHeight * maxHeightVh - maxHeightOffsetPx);
    recomputeMax();
    window.addEventListener("resize", recomputeMax);
    return () => window.removeEventListener("resize", recomputeMax);
  }, [maxHeightVh, maxHeightOffsetPx]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const target = height == null ? null : Math.min(maxPx, Math.max(minHeight, height));

  return (
    <motion.div
      className="w-full overflow-hidden"
      style={{ minHeight }}
      initial={false}
      animate={target == null ? undefined : { height: target }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children(contentRef)}
    </motion.div>
  );
}

function PairingPanel({ def }: { def: ChannelDef }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-[var(--border-hi)] bg-[var(--surface)] px-6 py-10 text-center">
      <QrCodeIcon className="size-10 text-[var(--muted)]" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--text)]">Pair {def.label}</p>
        <p className="text-xs text-[var(--muted)] max-w-sm">
          Pairing for {def.label} happens via QR code or device link. This UI is wired up next —
          for now, run the pairing command from the OpenClaw CLI or follow the docs link above.
        </p>
      </div>
      <a
        href={def.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1"
      >
        Open pairing instructions <ExternalLinkIcon className="size-3" />
      </a>
    </div>
  );
}
