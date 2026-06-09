"use client";

// "What are skills?" explainer dialog. Plain language for users who've never
// seen Claude/OpenClaw skills before.

import { BrainIcon, PuzzleIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const POINTS = [
  {
    icon: PuzzleIcon,
    title: "Things your agent can actually do",
    body: "A skill is a small, self-contained capability — send an email, search your calendar, generate a chart, control a smart-home device. Without skills, your agent can only talk.",
  },
  {
    icon: BrainIcon,
    title: "Loaded on demand",
    body: "Your agent reads each skill's description and picks the right one for the job. You don't have to remember command names or invoke skills manually.",
  },
  {
    icon: ShieldCheckIcon,
    title: "You decide what's installed",
    body: "Skills run on your instance with your credentials. Install only what you need; uninstall any time. Anything that needs setup (API keys, OAuth, CLIs) is flagged before it's used.",
  },
  {
    icon: SparklesIcon,
    title: "Built-in or custom",
    body: "The catalog ships with common skills out of the box. You can also drop your own into the skills folder — they're just files on disk.",
  },
];

export function AboutSkillsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl gap-0 !flex !flex-col overflow-hidden p-0">
        <div className="relative px-6 pt-7 pb-6 border-b border-[var(--border)]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 20% 0%, var(--accent), transparent 55%), radial-gradient(circle at 80% 100%, var(--accent), transparent 55%)",
              opacity: 0.08,
            }}
          />
          <DialogTitle className="relative text-xl font-semibold text-[var(--text)]">
            What are skills?
          </DialogTitle>
          <p className="relative mt-2 text-sm text-[var(--text-dim)] leading-relaxed max-w-prose">
            Skills are what turn your agent from a chatbot into something that gets work done.
            Each skill is a focused capability your agent can reach for when it's relevant.
          </p>
        </div>

        <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-md bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Icon className="size-3.5" />
                </div>
                <span className="text-sm font-medium text-[var(--text)]">{title}</span>
              </div>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-md border border-dashed border-[var(--border-hi)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs text-[var(--text-dim)] leading-relaxed">
              <span className="font-medium text-[var(--text)]">Tip:</span> Skills marked{" "}
              <span className="font-medium text-[var(--status-warning-text)]">Needs setup</span>{" "}
              are installed but missing something — usually an API key or a CLI. Open the card to
              finish wiring them up.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
