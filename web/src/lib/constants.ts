import {
  SendIcon,
  HashIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  WifiIcon,
  SmartphoneIcon,
} from "lucide-react";

// --- Markdown Prose Classes ---
export const PROSE_CLASSES = [
  "prose-chat text-sm leading-relaxed text-[var(--text)]",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3",
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3",
  "[&_li]:mb-1.5 [&_li]:leading-relaxed",
  "[&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2",
  "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-4 [&_h1:first-child]:mt-0",
  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2:first-child]:mt-0",
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2",
  "[&_code]:bg-[var(--surface-hi)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_code]:font-[var(--font-dm-mono),monospace]",
  "[&_pre]:bg-[var(--surface)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:mb-3 [&_pre]:overflow-x-auto",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs",
  "[&_hr]:border-[var(--border)] [&_hr]:my-4",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--accent)]/30 [&_blockquote]:pl-4 [&_blockquote]:text-[var(--text-dim)] [&_blockquote]:italic",
].join(" ");

// Compact version for dashboard/summary views
export const PROSE_CLASSES_COMPACT = "prose-chat text-xs leading-relaxed text-[var(--text-dim)] [&_code]:bg-[var(--surface-hi)] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[var(--surface)] [&_pre]:p-3 [&_pre]:my-2 [&_pre]:border [&_pre]:border-[var(--border)]/50";

// --- Region Labels ---
export const REGION_LABELS: Record<string, string> = {
  sin: "Singapore",
  sjc: "San Jose",
  iad: "Ashburn",
  ams: "Amsterdam",
  nrt: "Tokyo",
  syd: "Sydney",
};

// --- Channel Icons ---
export const CHANNEL_ICONS: Record<string, React.ElementType> = {
  telegram: SendIcon,
  discord: HashIcon,
  slack: MessageSquareIcon,
  signal: ShieldCheckIcon,
  whatsapp: MessageSquareIcon,
  imessage: SmartphoneIcon,
};

// --- Default Icons ---
export const DEFAULT_CHANNEL_ICON = WifiIcon;
