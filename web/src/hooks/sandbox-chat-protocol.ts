/**
 * Pure functions for parsing OpenClaw WebSocket protocol messages.
 * No React, no side effects — just data transformation.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp: number;
  toolName?: string;
  toolMeta?: string;
  toolError?: boolean;
  isStreaming?: boolean;
  // For role="system" entries — the __openclaw.kind tag (e.g. "compaction").
  systemKind?: string;
  // True when the assistant message originates from the Gateway itself
  // (model === "gateway-injected") — e.g. the post-compaction summary.
  gatewayNotice?: boolean;
  // For role="user" entries that came from an inline prompt — the id of the
  // prompt they answered. Lets the UI mark that prompt as answered after a
  // history reload.
  promptReplyId?: string;
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

// Sentinel characters (Unicode Private Use Area — survive JSON, never user-typed).
export const HIDDEN_START = "\uE001";
export const HIDDEN_END = "\uE002";

// Inline prompt block. Tag-style so the model can reliably emit it \u2014 PUA
// codepoints (which we tried first) get refused or escaped by most models.
export const PROMPT_START = "<rele-prompt>";
export const PROMPT_END = "</rele-prompt>";

export type PromptSpec = {
  id: string;
  kind: "text" | "choice" | "multi" | "confirm";
  title?: string;
  // Optional one-sentence explanation shown under the title — for context the
  // user might not have ("what's a Google Places API key, where do I get one?").
  description?: string;
  placeholder?: string;
  multiline?: boolean;
  options?: string[];
  confirmLabel?: string;
  denyLabel?: string;
};

export function extractPrompt(
  text: string,
): { before: string; prompt: PromptSpec; after: string } | null {
  const i = text.indexOf(PROMPT_START);
  if (i === -1) return null;
  const j = text.indexOf(PROMPT_END, i + PROMPT_START.length);
  if (j === -1) return null;
  try {
    const prompt = JSON.parse(text.slice(i + PROMPT_START.length, j)) as PromptSpec;
    if (!prompt?.id || !prompt?.kind) return null;
    return {
      before: text.slice(0, i),
      prompt,
      after: text.slice(j + PROMPT_END.length),
    };
  } catch {
    return null;
  }
}

// Strip hidden system prefix: \uE001...\uE002\n\n
export function stripHiddenPrefix(text: string): string {
  if (!text.startsWith(HIDDEN_START)) return text;
  const end = text.indexOf(HIDDEN_END);
  if (end === -1) return text;
  return text.slice(end + HIDDEN_END.length).replace(/^\n\n/, "");
}

// Pull the prompt id out of a `prompt-reply id=<id> value=...` hidden prefix.
export function extractPromptReplyId(text: string): string | null {
  if (!text.startsWith(HIDDEN_START)) return null;
  const end = text.indexOf(HIDDEN_END);
  if (end === -1) return null;
  const inner = text.slice(HIDDEN_START.length, end);
  const m = inner.match(/^prompt-reply\s+id=([\w.-]+)/);
  return m ? m[1] : null;
}

// User messages can be wrapped by OpenClaw with leading "System: ..." context
// lines and a per-turn "[Day YYYY-MM-DD HH:MM UTC] " timestamp prefix. Strip
// both so the chat bubble shows just what the human typed.
export function stripUserContextPrefix(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].startsWith("System:") || lines[i].trim() === "")) {
    i++;
  }
  const remaining = lines.slice(i).join("\n").trim();
  return remaining.replace(/^\[[^\]]+\]\s*/, "");
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

    const rawContent = extractText(m.content);
    return {
      id: baseId,
      role: m.role,
      content: m.role === "user" ? stripHiddenPrefix(rawContent) : rawContent,
      timestamp: m.timestamp ?? Date.now(),
      systemKind: m.role === "system" ? m.__openclaw?.kind : undefined,
      gatewayNotice: m.role === "assistant" && m.model === "gateway-injected",
      promptReplyId: m.role === "user" ? extractPromptReplyId(rawContent) ?? undefined : undefined,
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
