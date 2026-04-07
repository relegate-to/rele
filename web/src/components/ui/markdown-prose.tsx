import React from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { motion } from "framer-motion";
import { PROSE_CLASSES, PROSE_CLASSES_COMPACT } from "@/lib/constants";

interface MarkdownProseProps {
  children: string;
  className?: string;
  variant?: "full" | "compact";
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
  const baseClasses = variant === "full" ? PROSE_CLASSES : PROSE_CLASSES_COMPACT;
  const finalClassName = `${baseClasses} ${className}`;

  const content = (
    <Markdown remarkPlugins={[remarkBreaks]}>
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
