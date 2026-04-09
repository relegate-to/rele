/**
 * Pure functions for parsing OpenClaw WebSocket protocol messages.
 * No React, no side effects — just data transformation.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolMeta?: string;
  toolError?: boolean;
  isStreaming?: boolean;
}

export function formatArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const obj = args as Record<string, unknown>;
  if (typeof obj.path === "string") return obj.path;
  const vals = Object.values(obj);
  if (vals.length === 1 && typeof vals[0] === "string") return vals[0];
  if (vals.length > 0) return JSON.stringify(args);
  return "";
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).join("");
  if (content && typeof content === "object" && "text" in content) {
    return String((content as any).text);
  }
  return "";
}

function buildToolCallMap(
  messages: any[]
): Record<string, { name: string; meta: string }> {
  const map: Record<string, { name: string; meta: string }> = {};
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "toolCall" && block.id && block.name) {
          map[block.id] = { name: block.name, meta: formatArgs(block.arguments) };
        }
      }
    }
  }
  return map;
}

export function parseHistoryMessages(messages: any[]): ChatMessage[] {
  const toolCallMap = buildToolCallMap(messages);
  return messages.map((m: any, i: number) => {
    const runId = m.runId ?? m.id;
    const baseId = runId ? `run:${runId}` : `hist:${m.timestamp ?? i}-${i}`;

    if (m.role === "toolResult") {
      const entry = toolCallMap[m.toolCallId];
      const toolName = entry?.name ?? m.toolCallId ?? "tool";
      return {
        id: `tool:${m.toolCallId ?? baseId}`,
        role: "tool" as const,
        content: toolName,
        toolName,
        toolMeta: entry?.meta ?? "",
        toolError: m.isError ?? false,
        timestamp: m.timestamp ?? Date.now(),
      };
    }

    return {
      id: baseId,
      role: m.role,
      content: extractText(m.content),
      timestamp: m.timestamp ?? Date.now(),
    };
  });
}

// --- Tool events ---

export type ToolEventStart = {
  type: "start";
  chipId: string;
  message: ChatMessage;
};

export type ToolEventResult = {
  type: "result";
  chipId: string;
  isError: boolean;
  fallback: ChatMessage;
};

export type ToolEvent = ToolEventStart | ToolEventResult;

export function parseToolEvent(payload: any): ToolEvent | null {
  if (payload?.stream !== "tool") return null;
  const d = payload.data;
  if (!d?.phase) return null;

  const chipId = `tool:${d.toolCallId ?? payload.runId + ":" + payload.seq}`;

  if (d.phase === "start") {
    return {
      type: "start",
      chipId,
      message: {
        id: chipId,
        role: "tool",
        content: d.name,
        toolName: d.name,
        toolMeta: formatArgs(d.args),
        toolError: false,
        timestamp: payload.ts ?? Date.now(),
      },
    };
  }

  if (d.phase === "result") {
    return {
      type: "result",
      chipId,
      isError: d.isError ?? false,
      fallback: {
        id: chipId,
        role: "tool",
        content: d.name,
        toolName: d.name,
        toolMeta: d.meta ?? formatArgs(d.args),
        toolError: d.isError ?? false,
        timestamp: payload.ts ?? Date.now(),
      },
    };
  }

  return null;
}

// --- Chat stream events ---

export type ChatStreamEvent = {
  messageId: string;
  state: "delta" | "final" | "error";
  text: string;
};

export function parseChatEvent(payload: any): ChatStreamEvent | null {
  const runId = payload?.runId;
  if (!runId) return null;
  const state = payload?.state;
  if (!["delta", "final", "error"].includes(state)) return null;
  const text = extractText(payload?.message?.content ?? payload?.errorMessage ?? "");
  return { messageId: `run:${runId}`, state, text };
}
