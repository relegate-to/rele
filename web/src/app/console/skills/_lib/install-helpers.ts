"use client";

// Helpers for the AI-driven skill install flow.
//
// The agent is prompted to emit "STATUS: <short line>" before each action and
// end its final message with one of three sentinel codewords:
// INSTALL_OK / INSTALL_FAIL / INSTALL_ATTENTION. We parse those out for UI
// display and strip them when rendering the transcript.

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";
import { useChat } from "../../_context/chat-context";

export type InstallResult = "ok" | "fail" | "attention" | null;

// Background install sessions get labelled ".tmp set up <skillId>". Exported
// so the skills page can scan sessions.list and surface in-progress installs
// after a page refresh.
export const INSTALL_LABEL_PREFIX = ".tmp set up ";

export function detectResult(messages: ChatMessage[]): InstallResult {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.content.includes("INSTALL_OK")) return "ok";
    if (m.content.includes("INSTALL_FAIL")) return "fail";
    if (m.content.includes("INSTALL_ATTENTION")) return "attention";
    break; // only check the last assistant message
  }
  return null;
}

export const STATUS_RE = /^[*_]*STATUS:\s*(.+?)[\s*_]*$/m;
export const CODEWORD_RE = /\n?INSTALL_(OK|FAIL|ATTENTION)\b[\s\S]*$/;

export function latestStatus(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const match = m.content.match(STATUS_RE);
    if (match) return match[1].trim();
  }
  return null;
}

export function stripMarkers(content: string): string {
  return content.replace(STATUS_RE, "").replace(CODEWORD_RE, "").trim();
}

export function useSessionObserver(sessionKey: string | null) {
  const { observeSession, getSessionMessages, getSessionThinking } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    if (!sessionKey) {
      setMessages([]);
      setIsThinking(false);
      return;
    }
    setMessages(getSessionMessages(sessionKey));
    setIsThinking(getSessionThinking(sessionKey));
    return observeSession(sessionKey, () => {
      setMessages(getSessionMessages(sessionKey));
      setIsThinking(getSessionThinking(sessionKey));
    });
  }, [sessionKey, observeSession, getSessionMessages, getSessionThinking]);

  return { messages, isThinking };
}
