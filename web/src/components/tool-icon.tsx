import {
  AlertCircleIcon,
  FilePenIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  SearchIcon,
  TerminalIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";

export function ToolIcon({ name, isError }: { name: string; isError?: boolean }) {
  if (isError) {
    return <AlertCircleIcon className="size-3 shrink-0 text-[var(--status-error-text)]" />;
  }
  const n = name.toLowerCase();
  const cls = "size-3 shrink-0 text-[var(--muted)]";
  if (n === "read" || n.includes("read")) return <FileTextIcon className={cls} />;
  if (n === "write" || n === "edit" || n.includes("write") || n.includes("edit")) return <FilePenIcon className={cls} />;
  if (n === "bash" || n.includes("shell") || n.includes("exec") || n.includes("run")) return <TerminalIcon className={cls} />;
  if (n.includes("search")) return <SearchIcon className={cls} />;
  if (n.includes("fetch") || n.includes("web") || n.includes("http")) return <GlobeIcon className={cls} />;
  if (n.includes("delete") || n.includes("remove") || n.includes("trash")) return <Trash2Icon className={cls} />;
  if (n.includes("list") || n.includes("glob") || n.includes("dir") || n.includes("folder")) return <FolderIcon className={cls} />;
  return <WrenchIcon className={cls} />;
}
