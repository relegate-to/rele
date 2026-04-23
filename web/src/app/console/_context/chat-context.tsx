"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import { useSessions } from "./sessions-context";
import type { ChatMessage } from "@/hooks/sandbox-chat-protocol";

interface ChatContextValue {
  messages: ChatMessage[];
  connected: boolean;
  connecting: boolean;
  isThinking: boolean;
  error: string | null;
  sendMessage: (content: string, hiddenPrefix?: string) => void;
  sendToSession: (targetKey: string, content: string, hiddenPrefix?: string) => void;
  observeSession: (key: string, cb: () => void) => () => void;
  getSessionMessages: (key: string) => ChatMessage[];
  getSessionThinking: (key: string) => boolean;
  currentModel: string | null;
  setModel: (model: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { activeSessionKey } = useSessions();
  const chat = useSandboxChat(activeSessionKey);
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}
