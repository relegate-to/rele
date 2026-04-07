"use client";

// TODO: Refactor between chat/dashboard to remove redundancy.

import { useEffect, useState, useMemo, useCallback} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Copy, Check, X } from "lucide-react";

import {
  MessageSquareIcon,
  MonitorIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
  WifiIcon,
  SendIcon,
  HashIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  XIcon,
  CodeIcon
} from "lucide-react";
import { useMachinesContext } from "../_context/machines-context";
import { useInstanceStats } from "@/hooks/use-instance-stats";

// --- Helpers ---
const REGION_LABELS: Record<string, string> = {
  sin: "Singapore", sjc: "San Jose", iad: "Ashburn",
  ams: "Amsterdam", nrt: "Tokyo", syd: "Sydney",
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  telegram: SendIcon, discord: HashIcon, slack: MessageSquareIcon,
  signal: ShieldCheckIcon, whatsapp: MessageSquareIcon, imessage: SmartphoneIcon,
};

const PROSE_CLASSES = "prose-chat text-xs leading-relaxed text-[var(--text-dim)] [&_code]:bg-[var(--surface-hi)] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[var(--surface)] [&_pre]:p-3 [&_pre]:my-2 [&_pre]:border [&_pre]:border-[var(--border)]/50";

function flyStateToStatus(state: string) {
  switch (state) {
    case "started": case "running":    return "running";
    case "created": case "starting":   return "provisioning";
    case "stopping": case "destroying": return "stopping";
    case "stopped": case "destroyed":  return "stopped";
    default: return "error";
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Mono className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">{children}</Mono>;
}

// --- Components ---

function JsonModal({ data, onClose }: { data: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const prettyJson = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(data), null, 2);
    } catch {
      return data;
    }
  }, [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prettyJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3 shrink-0">
          <SectionLabel>Object Preview</SectionLabel>

          <div className="flex items-center gap-2">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="relative p-1.5  transition-all duration-150 hover:text-[var(--accent)] hover:border-[var(--accent)]/50 active:scale-90"
            >
              {copied ? (
                <Check className="size-4 text-[var(--accent)]" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1 hover:text-[var(--accent)] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[var(--bg)]/50">
          <pre className="text-[11px] leading-normal font-[var(--font-dm-mono)] text-[var(--text-dim)] whitespace-pre-wrap break-words">
            {prettyJson}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LogItem({ msg }: { msg: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);

  // Extract JSON from raw or fenced code blocks
  const extractJsonCandidate = useCallback((content: string) => {
    const trimmed = content.trim();

    // Match ```json ... ``` OR ```js ... ``` OR ``` ... ```
    const codeBlockMatch = trimmed.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    return trimmed;
  }, []);

  const jsonContent = useMemo(() => {
    return extractJsonCandidate(msg.content);
  }, [msg.content, extractJsonCandidate]);

  const isJson = useMemo(() => {
    try {
      if (
        (jsonContent.startsWith("{") && jsonContent.endsWith("}")) ||
        (jsonContent.startsWith("[") && jsonContent.endsWith("]"))
      ) {
        JSON.parse(jsonContent); // validate JSON
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [jsonContent]);

  const lines = msg.content.split(/\r?\n/);
  const shouldTruncate = lines.length > 3 || msg.content.length > 350;

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-[var(--border)]/30 py-3 last:border-0">
        <div className="flex items-center justify-between gap-4">

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {isJson ? (
              <button
                onClick={() => setShowJson(true)}
                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-hi)] text-[9px] font-bold uppercase tracking-tighter text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all cursor-pointer"
              >
                <CodeIcon className="size-2.5" /> JSON
              </button>
            ) : (
              <motion.div
                initial={false}
                animate={{ height: isExpanded ? "auto" : "1.5em" }}
                className={`${PROSE_CLASSES} overflow-hidden cursor-text`}
              >
                <Markdown remarkPlugins={[remarkBreaks]}>
                  {msg.content}
                </Markdown>
              </motion.div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex shrink-0 items-center gap-3">
            {!isJson && shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[8px] font-bold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              >
                [ {isExpanded ? "LESS" : "MORE"} ]
              </button>
            )}
            <Mono className="text-[10px] text-[var(--muted)] opacity-50">
              {formatTime(msg.timestamp)}
            </Mono>
            <span
              className={`font-[var(--font-dm-mono),monospace] text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded border transition-colors ${
                msg.role === "user"
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-border)]"
                  : "bg-[var(--surface-hi)] text-[var(--muted)] border-[var(--border)]"
              }`}
            >
              {msg.role}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showJson && (
          <JsonModal
            data={jsonContent}
            onClose={() => setShowJson(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function DashboardPage() {
  const { machines, loading, startMachine, stopMachine, refreshMachine } = useMachinesContext();
  const router = useRouter();
  const stats = useInstanceStats();
  const machine = machines[0];
  const isRunning = machine ? flyStateToStatus(machine.state) === "running" : false;

  useEffect(() => { if (isRunning) stats.connect(); }, [isRunning]);

  if (loading || !machine) return null;



  const displayMessages = [...stats.recentMessages]
    .filter(msg => msg.content?.trim().length > 0)
    .reverse().slice(0, 5);

  return (
    <div className="h-svh w-full bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-8 sm:py-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 sm:gap-7">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                <Mono className="text-xs text-[var(--muted)]">{machine.flyAppName}</Mono>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => refreshMachine(machine.id)} className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"><RefreshCwIcon className="size-3.5" /></button>
                {isRunning ? (
                  <button onClick={() => stopMachine(machine.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-[var(--status-error-border)] text-xs"><SquareIcon className="size-3.5" /><Mono>STOP</Mono></button>
                ) : (
                  <button onClick={() => startMachine(machine.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs"><PlayIcon className="size-3.5" /><Mono>START</Mono></button>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => router.push("/console/chat")} disabled={!isRunning} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hi)] disabled:opacity-40 cursor-pointer">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-hi)] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"><MessageSquareIcon className="size-5" /></div>
                <div><p className="text-base font-medium">Chat Console</p><p className="text-xs text-[var(--muted)]">Direct agent interaction</p></div>
              </button>
              <button onClick={() => router.push("/console/control-ui")} disabled={!isRunning} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hi)] disabled:opacity-40 cursor-pointer">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-hi)] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"><MonitorIcon className="size-5" /></div>
                <div><p className="text-base font-medium">Control UI</p><p className="text-xs text-[var(--muted)]">Visual interface management</p></div>
              </button>
            </div>

            {/* Activity */}
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-0.5"><MessageSquareIcon className="size-3 text-[var(--muted)]" /><SectionLabel>Recent Activity</SectionLabel></div>
              <div className="flex flex-col">{displayMessages.map(msg => <LogItem key={msg.id} msg={msg} />)}</div>
            </div>

            {/* Infrastructure */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-3">
               <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <SectionLabel>Gateway</SectionLabel>
                  <div className="flex items-center gap-2.5">
                    <div className={`size-2 rounded-full ${stats.gatewayConnected ? "bg-[var(--status-success)]" : "bg-[var(--muted)]"}`} />
                    <Mono className="text-sm font-medium uppercase">{stats.gatewayConnected ? "Connected" : "Offline"}</Mono>
                  </div>
               </div>
               <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <SectionLabel>Live Channels</SectionLabel>
                  <div className="flex flex-wrap gap-2.5">
                    {["telegram", "discord", "slack", "signal", "whatsapp"].map(id => {
                      const active = stats.channels.find(c => c.id === id)?.connected;
                      const Icon = CHANNEL_ICONS[id] || WifiIcon;
                      return (
                        <div key={id} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all ${active ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "border-[var(--border)] opacity-30 grayscale"}`}>
                          <Icon className="size-3.5" /><Mono className="text-[10px] font-bold uppercase">{id}</Mono>
                        </div>
                      );
                    })}
                  </div>
               </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 mt-2 border-t border-[var(--border)]">
              <div className="flex flex-col gap-1"><SectionLabel>Region</SectionLabel><Mono className="text-[13px]">{REGION_LABELS[machine.region] || machine.region}</Mono></div>
              <div className="flex flex-col gap-1"><SectionLabel>Machine ID</SectionLabel><Mono className="text-[13px]">{machine.flyMachineId.slice(0, 16)}</Mono></div>
              <div className="flex flex-col gap-1"><SectionLabel>Uptime</SectionLabel><Mono className="text-[13px]">{isRunning ? formatDuration(Date.now() - new Date(machine.updatedAt).getTime()) : "Stopped"}</Mono></div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
