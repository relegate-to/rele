"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { PromptSpec } from "@/hooks/sandbox-chat-protocol";

export type PromptSubmit = (displayValue: string, structured: unknown) => void;

// Renders an agent-supplied description. Allows inline markdown (links,
// bold/italic, code) — links open in a new tab so the user doesn't lose the
// prompt context. Block elements (lists, headings) aren't expected here.
export function PromptDescription({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("leading-relaxed [&_a]:font-medium [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:decoration-[var(--accent)]/60 [&_a]:decoration-2 [&_a]:underline-offset-2 [&_a:hover]:decoration-[var(--accent)] [&_strong]:font-semibold [&_strong]:text-[var(--text)] [&_em]:text-[var(--text)] [&_code]:rounded [&_code]:bg-[var(--surface-hi)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.95em] [&_code]:text-[var(--text)]", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
          ),
          p: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}

interface PromptFormProps {
  spec: PromptSpec;
  onSubmit: PromptSubmit;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Stateful form body for an inline prompt. Renders just the input(s) — the
// title and any surrounding chrome belong to the caller (InlinePrompt /
// PromptDialog).
export function PromptForm({ spec, onSubmit, disabled, autoFocus = true }: PromptFormProps) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const focusTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const id = requestAnimationFrame(() => focusTargetRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [autoFocus, disabled]);

  const submit = useCallback<PromptSubmit>(
    (display, structured) => {
      if (disabled) return;
      onSubmit(display, structured);
    },
    [disabled, onSubmit],
  );

  if (spec.kind === "text") {
    return (
      <div className="flex flex-col gap-2">
        {spec.multiline ? (
          <textarea
            ref={focusTargetRef as React.RefObject<HTMLTextAreaElement>}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={spec.placeholder}
            rows={3}
            disabled={disabled}
            className="min-h-[60px] w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
          />
        ) : (
          <input
            ref={focusTargetRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                e.preventDefault();
                submit(text.trim(), text.trim());
              }
            }}
            placeholder={spec.placeholder}
            disabled={disabled}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
          />
        )}
        <button
          type="button"
          disabled={disabled || !text.trim()}
          onClick={() => submit(text.trim(), text.trim())}
          className="self-end rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-30"
        >
          Send
        </button>
      </div>
    );
  }

  if (spec.kind === "choice") {
    return (
      <div className="flex flex-wrap gap-2">
        {(spec.options ?? []).map((opt, i) => (
          <button
            key={i}
            ref={i === 0 ? (focusTargetRef as React.RefObject<HTMLButtonElement>) : undefined}
            type="button"
            disabled={disabled}
            onClick={() => submit(opt, opt)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (spec.kind === "multi") {
    return (
      <div className="flex flex-col gap-2">
        {(spec.options ?? []).map((opt, i) => {
          const on = picked.has(i);
          return (
            <button
              key={i}
              ref={i === 0 ? (focusTargetRef as React.RefObject<HTMLButtonElement>) : undefined}
              type="button"
              disabled={disabled}
              onClick={() =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-[var(--bg)] px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
                on
                  ? "border-[var(--accent)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)]",
                )}
              >
                {on && <span className="text-[10px]">✓</span>}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled || picked.size === 0}
          onClick={() => {
            const opts = spec.options ?? [];
            const values = [...picked].sort().map((i) => opts[i]);
            submit(values.join(", "), values);
          }}
          className="mt-1 self-end rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-30"
        >
          Send
        </button>
      </div>
    );
  }

  // confirm
  return (
    <div className="flex gap-2">
      <button
        ref={focusTargetRef as React.RefObject<HTMLButtonElement>}
        type="button"
        disabled={disabled}
        onClick={() => submit(spec.confirmLabel ?? "Yes", true)}
        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
      >
        {spec.confirmLabel ?? "Yes"}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => submit(spec.denyLabel ?? "No", false)}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-50"
      >
        {spec.denyLabel ?? "No"}
      </button>
    </div>
  );
}
