"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIONS = [
  { value: "sin", label: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  { value: "sjc", label: "San Jose",  flag: "\u{1F1FA}\u{1F1F8}" },
  { value: "iad", label: "Ashburn",   flag: "\u{1F1FA}\u{1F1F8}" },
  { value: "ams", label: "Amsterdam", flag: "\u{1F1F3}\u{1F1F1}" },
  { value: "nrt", label: "Tokyo",     flag: "\u{1F1EF}\u{1F1F5}" },
  { value: "syd", label: "Sydney",    flag: "\u{1F1E6}\u{1F1FA}" },
] as const;

const DEFAULT_IMAGE = "ghcr.io/relegate-to/openclaw-sandbox:latest";
const GATE_PROXY = "/api/gate";

// ─── Phase derivation ─────────────────────────────────────────────────────────

type Phase = "setup" | "provisioning" | "ready";

function derivePhase(machines: { state: string }[]): Phase {
  if (machines.length === 0) return "setup";
  const state = machines[0].state;
  if (["created", "starting"].includes(state)) return "provisioning";
  if (["started", "running"].includes(state)) return "ready";
  return "setup";
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────

export function Onboarding() {
  const router = useRouter();
  const { machines, loading, createMachine } = useMachinesContext();

  const [region, setRegion] = useState("sin");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | undefined>(undefined);

  const phase = loading ? null : derivePhase(machines);

  // Redirect to dashboard when instance is ready
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (phase === "ready" && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/console/chat");
    }
  }, [phase, router]);

  async function handleCreate() {
    if (!apiKey.trim()) {
      setError("An OpenRouter API key is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const keyRes = await fetch(`${GATE_PROXY}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openrouter", name: "openrouter key", key: apiKey.trim() }),
      });
      if (!keyRes.ok) {
        const err = await keyRes.json().catch(() => ({ error: "Failed to save API key" }));
        throw new Error(err.error);
      }

      await createMachine({ image: DEFAULT_IMAGE, region });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create instance");
      setSubmitting(false);
    }
  }

  const isProvisioning = phase === "provisioning" || (submitting && phase !== "setup");

  // Lock the panel height when transitioning to provisioning
  useEffect(() => {
    if (isProvisioning && panelRef.current && !lockedHeight) {
      setLockedHeight(panelRef.current.offsetHeight);
    }
    if (!isProvisioning) setLockedHeight(undefined);
  }, [isProvisioning, lockedHeight]);

  return (
    <div className="flex min-h-[calc(100svh-3rem)] items-center justify-center bg-[var(--bg)] p-6 text-[var(--text)]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] shadow-[0_4px_32px_rgba(0,0,0,0.12)] lg:grid-cols-2"
      >
        {/* Left — form or provisioning */}
        <div ref={panelRef} className="relative flex flex-col justify-center px-10 py-12" style={lockedHeight ? { height: lockedHeight } : undefined}>
          <AnimatePresence mode="wait">
          {isProvisioning ? (
            <motion.div
              key="provisioning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-col items-center gap-5 py-8"
            >
              <svg viewBox="0 0 24 24" className="size-6 animate-spin text-[var(--copper)]" style={{ animationDuration: "1.5s" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <div className="text-center">
                <p className="font-[var(--font-dm-mono),monospace] text-sm font-medium text-[var(--text)]">
                  Spinning up your instance
                </p>
                <p className="mt-1.5 font-[var(--font-crimson-pro),serif] text-sm text-[var(--muted)]">
                  This usually takes 20&ndash;40 seconds.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
          <h1 className="font-['Lora',Georgia,serif] text-2xl italic tracking-[-0.01em]">
            Set up your instance
          </h1>
          <p className="mt-1.5 mb-8 font-[var(--font-crimson-pro),serif] text-[15px] leading-relaxed text-[var(--muted)]">
            Enter your OpenRouter key and pick a region.
          </p>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--text-dim)]">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(null); }}
              placeholder="sk-or-..."
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 px-3.5 py-2.5 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)] placeholder:text-[var(--muted)]/40 focus:border-[var(--copper)]/40 focus:outline-none transition-colors"
            />
            <p className="font-[var(--font-crimson-pro),serif] text-xs text-[var(--muted)]">
              Stored securely and injected at boot.
            </p>
          </div>

          {/* Region picker */}
          <div className="mt-6 flex flex-col gap-1.5">
            <label className="font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--text-dim)]">
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
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border py-2.5 transition-all ${
                      selected
                        ? "border-[var(--copper)]/40 bg-[var(--copper)]/8 text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
                    }`}
                  >
                    <span className="text-base leading-none">{r.flag}</span>
                    <span className="font-[var(--font-dm-mono),monospace] text-[11px]">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3.5 py-2.5">
              <p className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--status-error)]">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleCreate}
            className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--copper)] px-5 py-2.5 font-[var(--font-dm-mono),monospace] text-sm font-medium text-white transition-all hover:bg-[#b5744d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg viewBox="0 0 16 16" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 2a6 6 0 0 1 6 6" />
                </svg>
                Creating...
              </>
            ) : (
              "Deploy instance"
            )}
          </button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Right — decorative panel */}
        <div className="relative hidden overflow-hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--copper)]/20 via-[var(--surface-hi)] to-[var(--copper)]/10" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <div className="relative flex h-full flex-col items-center justify-center gap-6 px-10">
            <div className="flex size-20 items-center justify-center rounded-2xl border border-[var(--copper)]/20 bg-[var(--copper)]/10">
              <svg viewBox="0 0 24 24" className="size-10 text-[var(--copper)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-[var(--font-dm-mono),monospace] text-sm font-medium text-[var(--text)]">
                Your own AI sandbox
              </p>
              <p className="mt-1.5 max-w-[200px] font-[var(--font-crimson-pro),serif] text-sm leading-relaxed text-[var(--muted)]">
                A dedicated instance with your models, your config, your rules.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
