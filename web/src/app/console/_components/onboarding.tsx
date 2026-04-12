"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";
import { useGateway } from "../_context/gateway-context";

// ─── Name + icon generation ───────────────────────────────────────────────────

const ADJECTIVES = ["swift", "bright", "calm", "bold", "keen", "quiet", "crisp", "clear", "deep", "sharp", "still", "vast", "prime", "fresh", "lucid"];
const NOUNS = ["harbor", "forge", "haven", "peak", "vault", "ridge", "basin", "grove", "drift", "shelf", "reach", "gate", "field", "bloom", "shore"];
const ICONS = ["⚡", "🔥", "🌊", "🌿", "🎯", "🚀", "💫", "🔮", "🌙", "⭐", "🧊", "🦋"];

function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}

function randomIcon(): string {
  return ICONS[Math.floor(Math.random() * ICONS.length)];
}

// ─── Regions ──────────────────────────────────────────────────────────────────

const REGIONS = [
  { value: "sin", label: "Singapore", flag: "🇸🇬" },
  { value: "sjc", label: "San Jose",  flag: "🇺🇸" },
  { value: "iad", label: "Ashburn",   flag: "🇺🇸" },
  { value: "ams", label: "Amsterdam", flag: "🇳🇱" },
  { value: "nrt", label: "Tokyo",     flag: "🇯🇵" },
  { value: "syd", label: "Sydney",    flag: "🇦🇺" },
] as const;

const DEFAULT_IMAGE = "ghcr.io/relegate-to/openclaw-sandbox:latest";
const GATE_PROXY = "/api/gate";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "setup" | "provisioning" | "connecting" | "ready";
type Focus = "name" | "managed" | "byok" | "region";

function derivePhase(machines: { state: string }[], gatewayConnected: boolean): Phase {
  if (machines.length === 0) return "setup";
  const state = machines[0].state;
  if (["created", "starting"].includes(state)) return "provisioning";
  if (["started", "running"].includes(state)) return gatewayConnected ? "ready" : "connecting";
  return "setup";
}

// ─── Right panel content ──────────────────────────────────────────────────────

const MODEL_PILLS = ["Claude", "GPT-4o", "Gemini", "Llama", "Mistral", "DeepSeek"];

type PanelContent = {
  eyebrow: string;
  title: string;
  body: string;
  extra?: React.ReactNode;
};

function getPanelContent(focus: Focus): PanelContent {
  switch (focus) {
    case "name":
      return {
        eyebrow: "Your instance",
        title: "Make it yours",
        body: "Give your sandbox a name you'll recognize. It'll appear in your console and anywhere you manage it.",
      };
    case "managed":
      return {
        eyebrow: "Managed keys",
        title: "No API account needed",
        body: "We handle model access and bill you per use. Every major model available through a single connection.",
        extra: (
          <div className="mt-5 flex flex-wrap gap-2">
            {MODEL_PILLS.map((m) => (
              <span key={m} className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-[var(--font-dm-mono),monospace] text-[11px] text-white/60">
                {m}
              </span>
            ))}
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-[var(--font-dm-mono),monospace] text-[11px] text-white/40">
              +100 more
            </span>
          </div>
        ),
      };
    case "byok":
      return {
        eyebrow: "Bring your own key",
        title: "Use your OpenRouter account",
        body: "OpenRouter gives you access to 100+ models through a single API key. Your key is injected at boot and never leaves your instance.",
        extra: (
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 font-[var(--font-dm-mono),monospace] text-xs text-white/40 transition-colors hover:text-white/70"
          >
            openrouter.ai ↗
          </a>
        ),
      };
    case "region":
      return {
        eyebrow: "Region",
        title: "Where your instance lives",
        body: "Auto picks the best available datacenter. Manual selection gives you control over latency and data residency.",
      };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Onboarding() {
  const router = useRouter();
  const { machines, loading, createMachine } = useMachinesContext();
  const { connected: gatewayConnected } = useGateway();

  const [name, setName] = useState(() => generateName());
  const [icon, setIcon] = useState(() => randomIcon());
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [keyMode, setKeyMode] = useState<"managed" | "byok">("managed");
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [showRegions, setShowRegions] = useState(false);
  const [focus, setFocus] = useState<Focus>("managed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phase = loading ? null : derivePhase(machines, gatewayConnected);

  const hasRedirected = useRef(false);
  useEffect(() => {
    if (phase === "ready" && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/console/chat");
    }
  }, [phase, router]);

  async function handleCreate() {
    if (keyMode === "byok" && !apiKey.trim()) {
      setError("Enter your OpenRouter API key to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (keyMode === "byok") {
        const keyRes = await fetch(`${GATE_PROXY}/api-keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "openrouter", key: apiKey.trim() }),
        });
        if (!keyRes.ok) {
          const err = await keyRes.json().catch(() => ({ error: "Failed to save API key" }));
          throw new Error(err.error);
        }
      }

      await createMachine({
        image: DEFAULT_IMAGE,
        name: name.trim() || undefined,
        icon,
        ...(region ? { region } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create instance");
      setSubmitting(false);
    }
  }

  const isProvisioning =
    phase === "provisioning" ||
    phase === "connecting" ||
    (submitting && phase !== "setup");

  const panelContent = getPanelContent(focus);

  return (
    <div className="flex min-h-[100svh] bg-[var(--bg)] text-[var(--text)]">

      {/* ── Left: form ───────────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-8 py-16 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-sm"
        >
          <AnimatePresence mode="wait">
            {isProvisioning ? (

              /* ── Provisioning state ── */
              <motion.div
                key="provisioning"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-col items-center gap-6 py-8 text-center"
              >
                <div className="flex size-16 items-center justify-center rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] text-3xl shadow-sm">
                  {icon}
                </div>
                <div>
                  <p className="font-[var(--font-dm-mono),monospace] text-base font-medium text-[var(--text)]">
                    {phase === "connecting" ? `Connecting to ${name}` : `Launching ${name}`}
                  </p>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">
                    {phase === "connecting"
                      ? "Waiting for gateway connection…"
                      : "This usually takes 20–40 seconds."}
                  </p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  className="size-5 animate-spin text-[var(--accent)]"
                  style={{ animationDuration: "1.5s" }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </motion.div>

            ) : (

              /* ── Setup form ── */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-col gap-7"
              >
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.01em]">Get started</h1>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--muted)]">
                    Set up your instance in seconds.
                  </p>
                </div>

                {/* Name + icon */}
                <div className="flex flex-col gap-2">
                  <label className="font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--text-dim)]">
                    Instance name
                  </label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setShowIconPicker((v) => !v); setFocus("name"); }}
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 text-lg transition-colors hover:border-[var(--border-hi)]"
                      >
                        {icon}
                      </button>
                      <AnimatePresence>
                        {showIconPicker && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 4 }}
                            transition={{ duration: 0.15, ease: EASE }}
                            className="absolute left-0 top-12 z-10 grid w-[152px] grid-cols-4 gap-1 rounded-xl border border-[var(--border-hi)] bg-[var(--surface)] p-2 shadow-xl"
                          >
                            {ICONS.map((i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => { setIcon(i); setShowIconPicker(false); }}
                                className={`flex size-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-[var(--surface-hi)] ${icon === i ? "bg-[var(--accent)]/10" : ""}`}
                              >
                                {i}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setFocus("name")}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 px-3.5 py-2 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)] transition-colors focus:border-[var(--accent)]/40 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Key mode */}
                <div className="flex flex-col gap-2">
                  <label className="font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--text-dim)]">
                    API access
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["managed", "byok"] as const).map((mode) => {
                      const selected = keyMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => { setKeyMode(mode); setFocus(mode); setError(null); }}
                          className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-all ${
                            selected
                              ? "border-[var(--accent)]/40 bg-[var(--accent)]/8 text-[var(--text)]"
                              : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
                          }`}
                        >
                          <span className="font-[var(--font-dm-mono),monospace] text-xs font-medium">
                            {mode === "managed" ? "Let us handle it" : "Bring your own"}
                          </span>
                          <span className="text-xs leading-relaxed text-[var(--muted)]">
                            {mode === "managed" ? "No account needed" : "Use your key"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence initial={false}>
                    {keyMode === "byok" && (
                      <motion.div
                        key="key-input"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                          placeholder="sk-or-..."
                          autoFocus
                          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 px-3.5 py-2.5 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)] placeholder:text-[var(--muted)]/40 transition-colors focus:border-[var(--accent)]/40 focus:outline-none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Advanced */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showRegions;
                      setShowRegions(next);
                      setFocus(next ? "region" : keyMode);
                      if (!next) setRegion(null);
                    }}
                    className="flex items-center gap-1.5 font-[var(--font-dm-mono),monospace] text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className={`size-3 transition-transform ${showRegions ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                    Advanced options
                  </button>

                  <AnimatePresence initial={false}>
                    {showRegions && (
                      <motion.div
                        key="region-picker"
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <label className="mb-2 block font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--text-dim)]">
                          Region
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {REGIONS.map((r) => {
                            const selected = region === r.value;
                            return (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => setRegion(r.value)}
                                className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 transition-all ${
                                  selected
                                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/8 text-[var(--text)]"
                                    : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
                                }`}
                              >
                                <span className="text-base leading-none">{r.flag}</span>
                                <span className="font-[var(--font-dm-mono),monospace] text-[11px]">{r.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3.5 py-2.5">
                    <p className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--status-error)]">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCreate}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 font-[var(--font-dm-mono),monospace] text-sm font-medium text-white transition-all hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <svg viewBox="0 0 16 16" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M8 2a6 6 0 0 1 6 6" />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Launch instance →"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Right: contextual panel ───────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/20 via-[var(--surface-hi)] to-[var(--accent)]/8" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative w-full max-w-xs px-10">
          <AnimatePresence mode="wait">
            {isProvisioning ? (
              <motion.div
                key="panel-provisioning"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex flex-col items-center gap-5 text-center"
              >
                <div className="flex size-20 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-4xl">
                  {icon}
                </div>
                <div>
                  <p className="font-[var(--font-dm-mono),monospace] text-lg font-medium text-[var(--text)]">
                    {name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    Your instance is being created. It'll be ready to connect in a moment.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`panel-${focus}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <p className="mb-3 font-[var(--font-dm-mono),monospace] text-[11px] font-medium uppercase tracking-widest text-[var(--accent)]">
                  {panelContent.eyebrow}
                </p>
                <h2 className="text-2xl font-semibold leading-snug tracking-[-0.01em] text-[var(--text)]">
                  {panelContent.title}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
                  {panelContent.body}
                </p>
                {panelContent.extra}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
