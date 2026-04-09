"use client"

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Link2, Layers, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/format";

export function RoadmapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const roadmapItems = [
    {
      icon: ShieldCheck,
      title: "Hardening",
      description: "Fix bugs and improve stability across all components, enhance error handling, and add comprehensive logging.",
      priority: "high",
    },
    {
      icon: Link2,
      title: "MCP Management",
      description: "Build an MCP server for self-service gateway operations and safe, controlled agent actions.",
      priority: "high",
    },
    {
      icon: Layers,
      title: "Chat Improvements",
      description: "Add attachments, copying, exporting, and direct OpenClaw command invocation.",
      priority: "medium",
    },
    {
      icon: BookOpen,
      title: "UI Rendering",
      description: "Canvas-based rendering of interactive UIs with real-time collaboration visualization.",
      priority: "medium",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="size-5 text-primary" />
            Project Roadmap
          </DialogTitle>
          <DialogDescription>
            What we're working on and where we're headed
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {roadmapItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.2 }}
              className="flex gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-hi">
                <item.icon className="size-5 text-primary" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <span className="flex h-5 items-center rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary">
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDate(new Date())}
          </p>
        </div>

        <DialogClose asChild>
          <Button variant="outline" className="w-full">
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}