/**
 * Formatting utilities shared across chat and dashboard
 */

/**
 * Convert Fly machine state to normalized status
 */
export function flyStateToStatus(
  state: string
): "running" | "provisioning" | "stopping" | "stopped" | "error" {
  switch (state) {
    case "started":
    case "running":
      return "running";
    case "created":
    case "starting":
      return "provisioning";
    case "stopping":
    case "destroying":
      return "stopping";
    case "stopped":
    case "destroyed":
      return "stopped";
    default:
      return "error";
  }
}

/**
 * Format milliseconds to human-readable duration
 * @example 5000 -> "5s", 125000 -> "2m 5s"
 */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/**
 * Format timestamp to local time string
 * @example 1705001400000 -> "14:30"
 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format date to ISO-like string
 * @example 1705001400000 -> "2024-01-12"
 */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Pretty-print JSON with error handling
 */
export function prettyJson(data: string): string {
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
}

/**
 * Extract JSON from raw or fenced code blocks
 * @example "```json\n{...}\n```" -> "{...}"
 */
export function extractJsonFromCodeBlock(content: string): string {
  const trimmed = content.trim();
  const codeBlockMatch = trimmed.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return trimmed;
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(content: string): boolean {
  try {
    if (
      (content.startsWith("{") && content.endsWith("}")) ||
      (content.startsWith("[") && content.endsWith("]"))
    ) {
      JSON.parse(content);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
