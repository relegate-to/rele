"use client"

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BookOpen, Layers, Link2, MessageSquare, Smartphone, Sparkles, ShieldCheck, RocketIcon, XIcon, Wrench, CheckCircle2, Cloud, Plug, MonitorSmartphone, BotMessageSquare, KeyRound, CreditCard, Zap, Monitor, Activity, Terminal, FileCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const metadata = {
  date: "April 9, 2026",
  author: "Sam",
};

const roadmapItems = [
  {
    icon: ShieldCheck,
    title: "Hardening",
    priority: "high" as const,
    description: "Make the platform rock-solid before building more.",
    detail: {
      summary: "Instances are slow to start and sometimes refuse to stop or start. When OpenClaw restarts the gateway the system doesn't always recover. Instance resources should be configurable.",
      bullets: [
        "Fix slow instance start times and unresponsive stop/start",
        "Improve gateway recovery after OpenClaw-initiated restarts",
        "Make instance CPU and memory configurable per user",
        "Structured logging with trace IDs end-to-end",
        "Better recovery from network and machine failures",
      ],
    },
  },
  {
    icon: MessageSquare,
    title: "Session Management",
    priority: "high" as const,
    description: "Multi-session support and the ability to clear chats.",
    detail: {
      summary: "Right now you can only talk to the main OpenClaw session. There's no way to clear chats, start fresh, or run multiple parallel sessions.",
      bullets: [
        "Clear individual chats or full history",
        "Run and switch between parallel sessions",
        "Session list with search and filtering",
        "Name and organise sessions",
        "Persist session state across reconnects",
      ],
    },
  },
  {
    icon: Sparkles,
    title: "Chat Improvements",
    priority: "medium" as const,
    description: "Command invocation, copy/export, and attachments.",
    detail: {
      summary: "Direct OpenClaw command invocation from chat comes first, then copy/export, then file attachments. All things that make conversations more productive.",
      bullets: [
        "Direct OpenClaw command invocation from chat input",
        "One-click copy for messages and code blocks",
        "Export conversations to markdown or PDF",
        "File and image attachments",
        "Better code block rendering",
      ],
    },
  },
  {
    icon: BookOpen,
    title: "Chat Filtering",
    priority: "medium" as const,
    description: "Filter and search through your conversation history.",
    detail: {
      summary: "As conversations grow it becomes hard to find what you're looking for. Filtering lets you narrow down by message type, tool use, date, or keyword.",
      bullets: [
        "Search messages by keyword",
        "Filter by message type: text, tool calls, file writes",
        "Jump to any point in a long conversation",
      ],
    },
  },
  {
    icon: Wrench,
    title: "OpenClaw Interfaces",
    priority: "medium" as const,
    description: "A proper UI for configuring and monitoring OpenClaw.",
    detail: {
      summary: "OpenClaw currently lacks a management UI. Users need to configure their instance, see what OpenClaw is doing, and tweak behaviour without touching raw config files.",
      bullets: [
        "Visual configuration interface for OpenClaw settings",
        "Live view of active tools, tasks, and agent state",
        "Manage channels, skills, and permissions from the UI",
        "Guided onboarding for first-time setup",
        "Audit log of agent actions",
      ],
    },
  },
  {
    icon: BookOpen,
    title: "Agent Templates",
    priority: "medium" as const,
    description: "Start from a known-good config for common use cases.",
    detail: {
      summary: "Getting OpenClaw configured well requires a lot of upfront effort. Templates let users deploy a research, coding, or support agent without starting from scratch.",
      bullets: [
        "Curated library of starter templates",
        "One-click deploy from template to running instance",
        "Community-contributed templates",
        "Clone and customise existing configurations",
        "Version control for agent configs",
      ],
    },
  },
  {
    icon: Layers,
    title: "Skill Management",
    priority: "medium" as const,
    description: "Better tooling to manage, test, and update skills.",
    detail: {
      summary: "Skills are powerful but hard to manage. Users need a proper dashboard to see what's installed, test individual skills, and keep them up to date.",
      bullets: [
        "Unified skills dashboard with install/uninstall/update",
        "Per-skill usage stats and error rates",
        "Test a skill directly from the UI",
        "Skill versioning and rollback",
        "Dependency resolution between skills",
      ],
    },
  },
  {
    icon: Smartphone,
    title: "Mobile App",
    priority: "medium" as const,
    description: "Stay connected to your agents on the go.",
    detail: {
      summary: "A native mobile app lets users check in on running tasks, respond to agent questions, and kick off new work from anywhere.",
      bullets: [
        "Native iOS and Android apps",
        "Push notifications for agent events and completions",
        "Chat interface optimised for mobile",
        "Quick-launch common commands",
        "Secure biometric auth",
      ],
    },
  },
  {
    icon: KeyRound,
    title: "Managed API Keys",
    priority: "high" as const,
    description: "API keys for users who don't want to bring their own.",
    detail: {
      summary: "Not everyone wants to manage their own API keys. We'll offer managed keys so users can get started immediately without signing up to OpenRouter or any other provider.",
      bullets: [
        "Get started without a third-party API account",
        "Usage visible in the dashboard",
        "Switch between managed and bring-your-own at any time",
      ],
    },
  },
  {
    icon: CreditCard,
    title: "Pricing",
    priority: "high" as const,
    description: "Paid plans that sustainably fund the platform.",
    detail: {
      summary: "We need a sustainable business model to keep the lights on and invest in the platform. Pricing will be simple, fair, and tied to real value.",
      bullets: [
        "Simple, transparent pricing tiers",
        "Free tier for getting started",
        "Usage-based billing for API costs",
        "Team and organisation plans",
      ],
    },
  },
  {
    icon: Activity,
    title: "Monitoring",
    priority: "high" as const,
    description: "Visibility into instance health, errors, and usage.",
    detail: {
      summary: "Right now it's hard to know what your agent is doing, whether it's healthy, or why something went wrong. Monitoring brings that visibility into the console.",
      bullets: [
        "Instance health and uptime dashboard",
        "Error logs with context and stack traces",
        "Usage metrics: messages, tool calls, tokens",
        "Alerts for failures or unusual activity",
      ],
    },
  },
  {
    icon: Zap,
    title: "Performance",
    priority: "medium" as const,
    description: "Faster instance starts, lower latency, smoother UI.",
    detail: {
      summary: "Speed matters. Instances should start in seconds, responses should feel instant, and the UI should never make you wait.",
      bullets: [
        "Faster instance provisioning and cold starts",
        "Lower end-to-end response latency",
        "UI optimisations for large chat histories",
      ],
    },
  },
  {
    icon: Monitor,
    title: "Desktop Control",
    priority: "exploratory" as const,
    description: "A virtual desktop the agent can see and control.",
    detail: {
      summary: "Feasibility still being explored: give agents access to a virtual desktop so they can browse the web, run GUI apps, and interact with software that has no API.",
      bullets: [
        "Virtual desktop environment per user instance",
        "Agent can see the screen and control mouse/keyboard",
        "Live desktop view in the console",
        "Sandboxed and isolated per session",
      ],
    },
  },
  {
    icon: Smartphone,
    title: "Mobile Control",
    priority: "exploratory" as const,
    description: "Agent control over a virtual or real mobile device.",
    detail: {
      summary: "Feasibility still being explored: let agents interact with mobile apps — useful for automation, testing, and tasks that only exist on mobile.",
      bullets: [
        "Virtual or real mobile device access per instance",
        "Agent can tap, scroll, and type on mobile UI",
        "Useful for mobile-only apps and workflows",
      ],
    },
  },
  {
    icon: Link2,
    title: "MCP Management",
    priority: "low" as const,
    description: "Let OpenClaw make controlled config changes to its instance.",
    detail: {
      summary: "Rarely needed but worth building cleanly: OpenClaw may occasionally need to change configuration on the instance it runs on.",
      bullets: [
        "MCP server exposing gateway ops (restart, config, status)",
        "Safe, audited interface for agent-initiated changes",
        "Rate limiting and sandboxing for agent actions",
      ],
    },
  },
  {
    icon: Terminal,
    title: "SSH Access",
    priority: "medium" as const,
    description: "Drop into your instance directly from the console.",
    detail: {
      summary: "Sometimes you need direct access to the machine your agent runs on — to debug, inspect files, or run commands manually. SSH support brings a terminal right into the console.",
      bullets: [
        "In-browser terminal connected to your instance",
        "Full shell access for debugging and inspection",
        "Secure, session-scoped connections",
      ],
    },
  },
  {
    icon: FileCode,
    title: "File Editor",
    priority: "medium" as const,
    description: "Browse and edit files on your instance from the console.",
    detail: {
      summary: "A built-in file browser and editor so you can view and modify files on your instance without needing SSH or a separate tool.",
      bullets: [
        "Browse the instance filesystem from the console",
        "Edit files with syntax highlighting",
        "Upload and download files",
      ],
    },
  },
  {
    icon: RocketIcon,
    title: "UI Rendering",
    priority: "medium" as const,
    description: "Agents that build and serve interactive UI in the console.",
    detail: {
      summary: "Longer-term vision: agents that can generate and serve interactive interfaces directly in the console. Other things come first but this will be transformative.",
      bullets: [
        "Canvas-based rendering of agent-generated interfaces",
        "Real-time collaboration and presence visualisation",
        "Sandboxed execution for agent-authored UI code",
        "Smooth layout transitions and animation support",
      ],
    },
  },
];

const completedItems = [
  {
    icon: Cloud,
    title: "Cloud Infrastructure",
    description: "Per-user instances on Fly.io with persistent state.",
    detail: {
      summary: "The full cloud backbone: a gate service that provisions and manages isolated per-user OpenClaw instances, with persistent storage so agent state survives restarts.",
      bullets: [
        "Isolated per-user instances in the cloud",
        "Persistent storage for agent state across restarts",
        "Smooth provisioning flow from sign-up to running instance",
      ],
    },
  },
  {
    icon: Plug,
    title: "OpenClaw Integration",
    description: "Live connection to your agent with channel support.",
    detail: {
      summary: "Full integration with the OpenClaw agent runtime, including real-time streaming, self-upgrade support, and out-of-the-box channel configuration.",
      bullets: [
        "Real-time streaming connection to your agent",
        "Self-upgrade: agent restarts cleanly to apply updates",
        "Channels enabled by default (Telegram, Discord, Slack, Signal)",
        "Model selection via OpenRouter",
      ],
    },
  },
  {
    icon: BotMessageSquare,
    title: "Chat Interface",
    description: "Streaming responses, markdown, and tool visibility.",
    detail: {
      summary: "A real-time chat UI that streams assistant responses word-by-word, renders markdown, and shows what tools the agent is using as it works.",
      bullets: [
        "Word-by-word streaming with smooth animations",
        "Markdown rendering in assistant messages",
        "Inline visibility into tool calls and file writes",
      ],
    },
  },
  {
    icon: MonitorSmartphone,
    title: "Console UI",
    description: "Sidebar, dashboard, onboarding, and responsive layout.",
    detail: {
      summary: "The full console shell: a collapsible sidebar, a smooth onboarding flow, responsive design for all screen sizes, and a cohesive dark theme.",
      bullets: [
        "Collapsible sidebar with instance navigation",
        "Onboarding flow that transitions into the dashboard",
        "Responsive layout with mobile support",
      ],
    },
  },
];

const priorityStyles = {
  high: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20",
  medium: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20",
  low: "bg-[var(--surface-hi)] text-[var(--muted)] ring-1 ring-[var(--border)]",
  exploratory: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20",
};

export function RoadmapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<"planned" | "completed">("planned");
  const [selected, setSelected] = useState(0);
  const items = view === "planned" ? roadmapItems : completedItems;
  const active = items[selected];
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const checkFades = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 8);
    setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }, []);

  const handleScroll = checkFades;

  useEffect(() => {
    checkFades();
  }, [items, checkFades]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 ring-1 ring-[var(--accent)]/30"
        showCloseButton={false}
        style={{ maxWidth: "740px", width: "100%", height: "600px" }}
      >
        <div className="flex h-full flex-col">

          {/* header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <div className="flex items-center gap-2.5">
              <RocketIcon className="size-4 text-[var(--accent)]" />
              <DialogTitle className="text-sm font-semibold">Roadmap</DialogTitle>
              <DialogDescription className="sr-only">What we're building next</DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-md bg-[var(--surface-hi)] p-0.5 text-xs">
                <button
                  onClick={() => { setView("planned"); setSelected(0); setShowTopFade(false); setShowBottomFade(true); }}
                  className={`rounded px-3 py-1 font-medium transition-colors ${view === "planned" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text-dim)]"}`}
                >
                  Planned
                </button>
                <button
                  onClick={() => { setView("completed"); setSelected(0); setShowTopFade(false); setShowBottomFade(false); }}
                  className={`rounded px-3 py-1 font-medium transition-colors ${view === "completed" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text-dim)]"}`}
                >
                  Completed
                </button>
              </div>
              <DialogClose className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-hi)] hover:text-[var(--text)] transition-colors">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </div>

          {/* body */}
          <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] divide-x divide-[var(--border)]">

            {/* left — scrollable item list */}
            <div className="relative h-full min-h-0">
            <div ref={listRef} onScroll={handleScroll} className="absolute inset-0 flex flex-col gap-0.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((item, index) => (
                <motion.button
                  key={item.title}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.18 }}
                  onClick={() => setSelected(index)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    selected === index ? "bg-[var(--surface-hi)]" : "hover:bg-[var(--surface-hi)]/60"
                  }`}
                >
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                    selected === index ? "bg-[var(--accent-subtle)]" : "bg-[var(--surface-hi)]"
                  }`}>
                    <item.icon className={`size-3.5 transition-colors ${
                      selected === index ? "text-[var(--accent)]" : "text-[var(--muted)]"
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className={`truncate text-xs font-medium transition-colors ${
                        selected === index ? "text-[var(--text)]" : "text-[var(--text-dim)]"
                      }`}>{item.title}</span>
                      {"priority" in item && (
                        <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium ${priorityStyles[item.priority as keyof typeof priorityStyles]}`}>
                          {item.priority as string}
                        </span>
                      )}
                      {view === "completed" && (
                        <CheckCircle2 className="shrink-0 size-3 text-emerald-500" />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{item.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
            <div className={`pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[var(--surface)] to-transparent transition-opacity duration-200 ${showTopFade ? "opacity-100" : "opacity-0"}`} />
            <div className={`pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--surface)] to-transparent transition-opacity duration-200 ${showBottomFade ? "opacity-100" : "opacity-0"}`} />
            </div>

            {/* right — detail panel */}
            <div className="h-full overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)]">
                      <active.icon className="size-6 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text)]">{active.title}</h3>
                      {"priority" in active ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityStyles[active.priority as keyof typeof priorityStyles]}`}>
                          {active.priority as string} priority
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                          <CheckCircle2 className="size-3" /> Completed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-[var(--muted)]">{active.detail.summary}</p>

                  <ul className="space-y-3">
                    {active.detail.bullets.map((b, i) => (
                      <motion.li
                        key={b}
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.15 }}
                        className="flex items-start gap-3 text-sm text-[var(--text-dim)]"
                      >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]/50" />
                        {b}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <p className="text-xs text-[var(--muted)]">Updated {metadata.date}</p>
            <p className="text-xs text-[var(--muted)]">by {metadata.author}</p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
