"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useChat } from "../_context/chat-context";
import { useSessionObserver } from "../skills/_lib/install-helpers";
import {
  extractPrompt,
  stripHiddenPrefix,
  stripUserContextPrefix,
  type ChatMessage,
  type PromptSpec,
} from "@/hooks/sandbox-chat-protocol";

export type PendingPrompt = {
  spec: PromptSpec;
  msgId: string;
  timestamp: number;
  // The display value the user replied with, if they've already answered.
  answeredWith?: string;
};

export type SendPromptReply = (id: string, displayValue: string, structured: unknown) => void;

export function buildPromptReplyHiddenPrefix(id: string, structured: unknown): string {
  return `prompt-reply id=${id} value=${JSON.stringify(structured)}`;
}

// Walk the messages once, pulling out every inline prompt block and joining it
// to the matching prompt-reply user message (if any).
export function usePendingPrompts(messages: ChatMessage[]): PendingPrompt[] {
  return useMemo(() => {
    const replies = new Map<string, string>();
    for (const m of messages) {
      if (m.role === "user" && m.promptReplyId) {
        replies.set(m.promptReplyId, stripUserContextPrefix(stripHiddenPrefix(m.content)));
      }
    }
    const out: PendingPrompt[] = [];
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      const ex = extractPrompt(m.content);
      if (!ex) continue;
      out.push({
        spec: ex.prompt,
        msgId: m.id,
        timestamp: m.timestamp,
        answeredWith: replies.get(ex.prompt.id),
      });
    }
    return out;
  }, [messages]);
}

interface PromptListenerProps {
  // Receives the most recent unanswered prompt (or null) plus a reply callback.
  // Render whatever UI you want — modal, side panel, nothing.
  children: (current: PendingPrompt | null, reply: SendPromptReply) => ReactNode;
  // Observe a non-default session (e.g. a background install session). When
  // omitted, listens on the active main session.
  sessionKey?: string;
}

// Headless: surfaces inline prompts from a chat session to whatever UI the
// consumer renders via the children render-prop.
export function PromptListener({ children, sessionKey }: PromptListenerProps) {
  const chat = useChat();
  const session = useSessionObserver(sessionKey ?? null);
  const messages = sessionKey ? session.messages : chat.messages;
  const prompts = usePendingPrompts(messages);
  const current = prompts.find((p) => p.answeredWith === undefined) ?? null;

  const reply = useCallback<SendPromptReply>(
    (id, displayValue, structured) => {
      const hidden = buildPromptReplyHiddenPrefix(id, structured);
      if (sessionKey) chat.sendToSession(sessionKey, displayValue, hidden);
      else chat.sendMessage(displayValue, hidden);
    },
    [chat, sessionKey],
  );

  return <>{children(current, reply)}</>;
}
