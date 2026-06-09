"use client";

// "What are channels?" explainer dialog. Plain language, no jargon — assumes
// the reader has never set up a chatbot before.

import { Link2Icon, MessageSquareIcon, RouteIcon, ShieldCheckIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const POINTS = [
  {
    icon: MessageSquareIcon,
    title: "Talk to your agent anywhere",
    body: "Telegram, Slack, Discord, WhatsApp, iMessage, email — wherever you already chat. Your agent shows up as a contact and replies in real time.",
  },
  {
    icon: RouteIcon,
    title: "One brain, many doors",
    body: "Every channel feeds into the same agent. A note you drop in Slack at work and a question you ask in Telegram at night share the same memory and skills.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Your accounts, your credentials",
    body: "Channels run on tokens you own — your Telegram bot, your Slack workspace. Nothing routes through a third party, and you can revoke any channel from its own service at any time.",
  },
  {
    icon: Link2Icon,
    title: "Add what you need, ignore the rest",
    body: "Start with one channel (Telegram is the fastest). Add more later as the agent fits into the rest of your life.",
  },
];

export function AboutChannelsDialog({
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
            What are channels?
          </DialogTitle>
          <p className="relative mt-2 text-sm text-[var(--text-dim)] leading-relaxed max-w-prose">
            Channels are the ways your agent reaches you — and you reach it. Connect a messaging
            app you already use, and your agent becomes just another contact in that app.
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
              <span className="font-medium text-[var(--text)]">New here?</span> Start with{" "}
              <span className="font-medium text-[var(--text)]">Telegram</span> — it takes about a
              minute. Open the Telegram card, follow the steps, and send your agent a message.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
