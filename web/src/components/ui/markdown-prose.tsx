"use client";

import React, { useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { CopyIcon, CheckIcon } from "lucide-react";
import { PROSE_CLASSES, PROSE_CLASSES_COMPACT, PROSE_CLASSES_USER } from "@/lib/constants";

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group/code relative mb-3">
      <pre ref={preRef} {...props} className="!mb-0">
        {children}
      </pre>
      <motion.button
        onClick={handleCopy}
        whileTap={{ scale: 0.78 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        className={`absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors duration-150 hover:text-[var(--text)] ${copied ? "opacity-100" : "opacity-0 group-hover/code:opacity-100"}`}
        aria-label="Copy code"
      >
        <AnimatePresence mode="sync" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 700, damping: 18 }}
            >
              <CheckIcon className="size-3.5 text-[var(--accent)]" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 700, damping: 18 }}
            >
              <CopyIcon className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

interface MarkdownProseProps {
  children: string;
  className?: string;
  variant?: "full" | "compact" | "user";
  isStreaming?: boolean;
}

/**
 * Markdown renderer with consistent prose styling across chat and dashboard
 */
export function MarkdownProse({
  children,
  className = "",
  variant = "full",
  isStreaming = false,
}: MarkdownProseProps) {
  const baseClasses = variant === "full" ? PROSE_CLASSES : variant === "user" ? PROSE_CLASSES_USER : PROSE_CLASSES_COMPACT;
  const finalClassName = `${baseClasses} ${className}`;

  const content = (
    <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={variant !== "user" ? { pre: CodeBlock } : undefined}>
      {children}
    </Markdown>
  );

  if (isStreaming) {
    return (
      <motion.div
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={finalClassName}
      >
        {content}
      </motion.div>
    );
  }

  return <div className={finalClassName}>{content}</div>;
}
