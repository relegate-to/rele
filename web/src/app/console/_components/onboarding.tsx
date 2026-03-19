"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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

const DEFAULT_IMAGE = "alpine/openclaw:main";

// ─── Stage derivation ─────────────────────────────────────────────────────────

type Stage = "create" | "provisioning" | "connect" | "build";

function deriveStage(machines: { state: string }[], sawProvision: boolean): Stage {
  if (machines.length === 0) return "create";
  const state = machines[0].state;
  if (["created", "starting"].includes(state)) return "provisioning";
  if (["started", "running"].includes(state)) {
    return sawProvision ? "connect" : "build";
  }
  return "create";
}

const STAGE_ORDER: Stage[] = ["create", "provisioning", "connect", "build"];

function stageIndex(s: Stage) {
  return STAGE_ORDER.indexOf(s);
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
      <path d="M14 6h4" />
      <path d="M14 18h4" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepBadge({ number, status }: { number: number; status: "active" | "done" | "upcoming" }) {
  if (status === "done") {
    return (
      <span className="flex size-9 items-center justify-center rounded-full bg-[var(--status-success)] text-white">
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-full font-[var(--font-dm-mono),monospace] text-sm font-medium ${
        status === "active"
          ? "bg-[var(--copper)] text-white shadow-[0_0_12px_rgba(200,132,90,0.3)]"
          : "border border-[var(--border)] text-[var(--muted)]"
      }`}
    >
      {number}
    </span>
  );
}

function StepCard({
  icon,
  number,
  title,
  subtitle,
  description,
  status,
  children,
  cardRef,
}: {
  icon: React.ReactNode;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  status: "active" | "done" | "upcoming";
  children?: React.ReactNode;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      className={`overflow-hidden rounded-2xl border transition-all duration-500 ${
        status === "active"
          ? "border-[var(--copper)]/30 bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.06),0_0_0_1px_rgba(200,132,90,0.1)]"
          : status === "done"
            ? "border-[var(--status-success-border)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)] opacity-35"
      }`}
    >
      {/* Card header */}
      <div className="flex items-start gap-4 px-7 py-6">
        <StepBadge number={number} status={status} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-dm-mono),monospace] text-base font-medium text-[var(--text)]">
              {title}
            </span>
            {status === "done" && (
              <span className="rounded-full bg-[var(--status-success)]/10 px-2 py-0.5 font-[var(--font-dm-mono),monospace] text-[11px] text-[var(--status-success)]">
                Complete
              </span>
            )}
          </div>
          <span className="font-[var(--font-crimson-pro),serif] text-[15px] leading-snug text-[var(--text-dim)]">
            {subtitle}
          </span>
        </div>
        <div className={`shrink-0 transition-colors duration-500 ${
          status === "active" ? "text-[var(--copper)]" : status === "done" ? "text-[var(--status-success)]" : "text-[var(--muted)]"
        }`}>
          {icon}
        </div>
      </div>

      {/* Card description — always visible for active */}
      {status === "active" && (
        <div className="border-t border-[var(--border)]/60 px-7 py-5">
          <p className="mb-5 font-[var(--font-crimson-pro),serif] text-[15px] leading-relaxed text-[var(--muted)]">
            {description}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Stage 1: Create Instance ─────────────────────────────────────────────────

function CreateContent() {
  const { createMachine } = useMachinesContext();
  const [region, setRegion] = useState("sin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      await createMachine({ image: DEFAULT_IMAGE, region });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create instance");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        {REGIONS.map((r) => {
          const selected = region === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => setRegion(r.value)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                selected
                  ? "border-[var(--copper)]/40 bg-[var(--copper)]/8 text-[var(--text)] shadow-[0_0_0_1px_rgba(200,132,90,0.15)]"
                  : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
              }`}
            >
              <span className="text-lg leading-none">{r.flag}</span>
              <div className="flex flex-col">
                <span className="font-[var(--font-dm-mono),monospace] text-sm font-medium">{r.label}</span>
                <span className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--muted)]">{r.value}</span>
              </div>
              {selected && (
                <svg viewBox="0 0 16 16" className="ml-auto size-4 text-[var(--copper)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3">
          <p className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--status-error)]">{error}</p>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={handleCreate}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--copper)] px-5 py-3 font-[var(--font-dm-mono),monospace] text-sm font-medium text-white shadow-[0_2px_8px_rgba(200,132,90,0.25)] transition-all hover:bg-[#b5744d] hover:shadow-[0_4px_16px_rgba(200,132,90,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <svg viewBox="0 0 16 16" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 2a6 6 0 0 1 6 6" />
              </svg>
              Creating instance...
            </>
          ) : (
            "Create instance"
          )}
        </button>
      </div>

      <p className="mt-3 text-center font-[var(--font-crimson-pro),serif] text-xs text-[var(--muted)]">
        Powered by Fly.io &middot; Deploys in under a minute
      </p>
    </>
  );
}

// ─── Stage 2: Provisioning ────────────────────────────────────────────────────

function ProvisioningContent() {
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="relative flex size-16 items-center justify-center">
        <svg viewBox="0 0 64 64" className="size-16 animate-spin" style={{ animationDuration: "2s" }}>
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="3" />
          <path d="M32 6a26 26 0 0 1 26 26" fill="none" stroke="var(--copper)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <p className="font-[var(--font-dm-mono),monospace] text-sm font-medium text-[var(--text)]">
          Spinning up your instance...
        </p>
        <p className="mt-2 font-[var(--font-crimson-pro),serif] text-sm leading-relaxed text-[var(--muted)]">
          We&rsquo;re provisioning a dedicated machine on Fly.io.<br />
          This usually takes 20&ndash;40 seconds.
        </p>
      </div>
      <div className="flex items-center gap-6 pt-2">
        <ProvisioningStep label="Creating VM" done />
        <ProvisioningStep label="Networking" />
        <ProvisioningStep label="Health check" />
      </div>
    </div>
  );
}

function ProvisioningStep({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {done ? (
        <svg viewBox="0 0 16 16" className="size-3.5 text-[var(--status-success)]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      ) : (
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--copper)]" />
      )}
      <span className={`font-[var(--font-dm-mono),monospace] text-xs ${done ? "text-[var(--status-success)]" : "text-[var(--muted)]"}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Stage 3: Connect ─────────────────────────────────────────────────────────

function ConnectContent({ onContinue }: { onContinue: () => void }) {
  const { machines } = useMachinesContext();
  const machine = machines[0];
  const [copied, setCopied] = useState(false);

  const url = machine ? `https://${machine.flyAppName}.fly.dev` : "";

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-2.5">
        <span className="size-2 rounded-full bg-[var(--status-success)]" />
        <span className="font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--status-success)]">
          Instance is running
        </span>
        <span className="ml-auto font-[var(--font-dm-mono),monospace] text-xs text-[var(--muted)]">
          {machine?.region ?? ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-[var(--font-dm-mono),monospace] text-xs font-medium text-[var(--text-dim)]">
          Instance URL
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)]">
            {url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className={`shrink-0 cursor-pointer rounded-lg border px-4 py-2.5 font-[var(--font-dm-mono),monospace] text-xs transition-all ${
              copied
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--copper)] px-5 py-3 font-[var(--font-dm-mono),monospace] text-sm font-medium text-white shadow-[0_2px_8px_rgba(200,132,90,0.25)] transition-all hover:bg-[#b5744d] hover:shadow-[0_4px_16px_rgba(200,132,90,0.3)]"
      >
        Continue
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}

// ─── Stage 4: Build ───────────────────────────────────────────────────────────

function BuildContent() {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-[var(--font-crimson-pro),serif] text-base leading-relaxed text-[var(--text-dim)]">
        Your OpenClaw instance is live and ready. Head to the dashboard to manage
        your instance, or check the status page for real-time health &amp; diagnostics.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/console/dashboard"
          className="flex flex-col items-center gap-2 rounded-xl bg-[var(--copper)] px-5 py-4 text-center text-white shadow-[0_2px_8px_rgba(200,132,90,0.25)] transition-all hover:bg-[#b5744d] hover:shadow-[0_4px_16px_rgba(200,132,90,0.3)]"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="font-[var(--font-dm-mono),monospace] text-sm font-medium">Dashboard</span>
        </Link>
        <Link
          href="/console/status"
          className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-4 text-center text-[var(--text-dim)] transition-all hover:border-[var(--border-hi)] hover:text-[var(--text)]"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span className="font-[var(--font-dm-mono),monospace] text-sm font-medium">Status</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────

const STEPS = [
  {
    key: "create" as Stage,
    number: 1,
    title: "Create instance",
    subtitle: "Choose a region closest to you for the best performance.",
    description: "Your OpenClaw instance will be deployed as a dedicated machine on Fly.io. Pick the region nearest to you or your users for the lowest latency.",
    icon: <GlobeIcon className="size-6" />,
  },
  {
    key: "provisioning" as Stage,
    number: 2,
    title: "Provisioning",
    subtitle: "Sit tight while we set up your dedicated machine.",
    description: "We're creating a VM, configuring networking, and running initial health checks on your new instance.",
    icon: <ServerIcon className="size-6" />,
  },
  {
    key: "connect" as Stage,
    number: 3,
    title: "Connect",
    subtitle: "Your instance is live. Save your connection details.",
    description: "Your OpenClaw instance is now running. Copy the URL below to connect from your local environment or share it with your team.",
    icon: <LinkIcon className="size-6" />,
  },
  {
    key: "build" as Stage,
    number: 4,
    title: "Start building",
    subtitle: "Everything is ready. Time to build something great.",
    description: "Your instance is fully provisioned and healthy. You can manage it from the dashboard or monitor its health on the status page.",
    icon: <RocketIcon className="size-6" />,
  },
];

export function Onboarding() {
  const { machines, loading } = useMachinesContext();

  const sawProvisionRef = useRef(false);
  const [buildUnlocked, setBuildUnlocked] = useState(false);

  const rawStage = loading ? null : deriveStage(machines, false);
  if (rawStage === "provisioning") {
    sawProvisionRef.current = true;
  }

  const stage: Stage = loading
    ? "create"
    : buildUnlocked
      ? "build"
      : deriveStage(machines, sawProvisionRef.current);

  // Auto-scroll on stage change
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevStageRef = useRef(stage);

  useEffect(() => {
    if (stage !== prevStageRef.current) {
      prevStageRef.current = stage;
      const idx = stageIndex(stage);
      const el = cardRefs.current[idx];
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    }
  }, [stage]);

  function stepStatus(stepKey: Stage): "active" | "done" | "upcoming" {
    const current = stageIndex(stage);
    const step = stageIndex(stepKey);
    if (step < current) return "done";
    if (step === current) return "active";
    return "upcoming";
  }

  return (
    <div className="relative min-h-[calc(100svh-3rem)] bg-[var(--bg)] text-[var(--text)]">
      <div className="relative z-10 mx-auto max-w-[820px] px-8 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-12 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#c8845a]/30 bg-[#fdf6ee] font-['Lora',Georgia,serif] text-base italic text-[#c8845a]">
              r
            </div>
            <h1 className="font-['Lora',Georgia,serif] text-3xl italic tracking-[-0.01em]">
              Welcome to rele
            </h1>
          </div>
          <p className="max-w-[480px] font-[var(--font-crimson-pro),serif] text-lg leading-relaxed text-[var(--text-dim)]">
            Let&rsquo;s get you set up. Follow the steps below to launch and
            connect to your OpenClaw instance.
          </p>
        </motion.div>

        {/* Step cards */}
        <div className="flex flex-col gap-5">
          {STEPS.map((step, i) => {
            const status = stepStatus(step.key);
            return (
              <StepCard
                key={step.key}
                icon={step.icon}
                number={step.number}
                title={step.title}
                subtitle={step.subtitle}
                description={step.description}
                status={status}
                cardRef={(el) => { cardRefs.current[i] = el; }}
              >
                {step.key === "create" && <CreateContent />}
                {step.key === "provisioning" && <ProvisioningContent />}
                {step.key === "connect" && <ConnectContent onContinue={() => setBuildUnlocked(true)} />}
                {step.key === "build" && <BuildContent />}
              </StepCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
