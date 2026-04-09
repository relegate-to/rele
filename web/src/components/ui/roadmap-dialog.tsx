"use client"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link2, Layers, RocketIcon, ShieldCheck, XIcon } from "lucide-react";
import { motion } from "framer-motion";

const metadata = {
  date: "April 9, 2026",
  author: "Sam",
};

const roadmapItems = [
  {
    icon: ShieldCheck,
    title: "Hardening",
    description: "Fix bugs and improve stability across all components, enhance error handling, and add comprehensive logging.",
    priority: "high" as const,
  },
  {
    icon: Link2,
    title: "MCP Management",
    description: "Build an MCP server for self-service gateway operations and safe, controlled agent actions.",
    priority: "high" as const,
  },
  {
    icon: Layers,
    title: "Chat Improvements",
    description: "Add attachments, copying, exporting, and direct OpenClaw command invocation.",
    priority: "medium" as const,
  },
  {
    icon: RocketIcon,
    title: "UI Rendering",
    description: "Canvas-based rendering of interactive UIs with real-time collaboration visualization.",
    priority: "medium" as const,
  },
];

const priorityStyles = {
  high: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20",
  medium: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20",
};

export function RoadmapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" showCloseButton={false}>

        {/* gradient header — compact */}
        <div
          className="relative flex items-center justify-between px-5 py-3"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, purple) 100%)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_60%)]" />
          <div className="relative flex items-center gap-2.5">
            <RocketIcon className="size-4 text-white/90" />
            <DialogTitle className="text-sm font-semibold text-white">Roadmap</DialogTitle>
            <DialogDescription className="sr-only">What we're building next</DialogDescription>
          </div>
          <DialogClose className="relative rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        {/* items */}
        <div className="space-y-2 p-5">
          {roadmapItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07, duration: 0.2 }}
              className="flex gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-hi">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityStyles[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* footer metadata */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">Updated {metadata.date}</p>
          <p className="text-xs text-muted-foreground">by {metadata.author}</p>
        </div>

      </DialogContent>
    </Dialog>
  );
}
