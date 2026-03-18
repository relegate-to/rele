import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// ─── Usage ────────────────────────────────────────────────────────────────────
//
// With an instance:
//   <SidebarMenu>
//     <InstanceItem instance={instance} isActive onStop={...} onRestart={...} />
//   </SidebarMenu>
//
// Without an instance (empty state):
//   <SidebarMenu>
//     <AddInstanceItem onClick={handleAdd} />
//   </SidebarMenu>
//
// Drive from data:
//   <SidebarMenu>
//     {instance
//       ? <InstanceItem instance={instance} ... />
//       : <AddInstanceItem onClick={handleAdd} />}
//   </SidebarMenu>

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstanceStatus = "running" | "provisioning" | "stopped" | "error"

export interface Instance {
  id: string
  name: string
  status: InstanceStatus
  /** Uptime string e.g. "3h 42m" — shown when running */
  uptime?: string
  /** Spend so far this session e.g. "¥420" — shown when running */
  spend?: string
  /** Human-readable time e.g. "2d ago" — shown when stopped */
  lastActive?: string
}

interface InstanceItemProps {
  instance: Instance
  isActive?: boolean
  onClick?: () => void
  onStop?: () => void
  onStart?: () => void
  onRestart?: () => void
  onCancel?: () => void
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  InstanceStatus,
  {
    icon: string
    dot: string
    outline: string
  }
> = {
  running: {
    icon:    "border-[#c8845a]/30 bg-[#fdf6ee] text-[#c8845a]",
    dot:     "bg-green-500",
    outline: "border-[#c8845a]/30 hover:border-[#c8845a]/50",
  },
  provisioning: {
    icon:    "border-indigo-300/30 bg-indigo-50 text-indigo-400",
    dot:     "bg-indigo-400 animate-pulse",
    outline: "border-indigo-300/30 hover:border-indigo-300/50",
  },
  stopped: {
    icon:    "border-sidebar-border bg-sidebar text-sidebar-foreground/25",
    dot:     "bg-sidebar-foreground/30",
    outline: "border-sidebar-border hover:border-sidebar-border/60",
  },
  error: {
    icon:    "border-destructive/30 bg-destructive/10 text-destructive",
    dot:     "bg-destructive",
    outline: "border-destructive/30 hover:border-destructive/50",
  },
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function StopIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="currentColor">
      <rect x="3" y="3" width="6" height="6" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="currentColor">
      <path d="M4 2.5l5 3.5-5 3.5V2.5z" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2.5A4.5 4.5 0 1 0 10 6.5" />
      <path d="M10 2.5V5H7.5" />
    </svg>
  )
}

function CancelIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M6 1v10M1 6h10" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="flex size-6 cursor-pointer items-center justify-center rounded-[5px] border border-sidebar-border bg-sidebar text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-sidebar-accent group-hover/item:opacity-100"
    >
      {children}
    </div>
  )
}

function InstanceIcon({ status }: { status: InstanceStatus }) {
  const { icon, dot } = statusConfig[status]
  return (
    <div
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg border font-['Lora',Georgia,serif] text-sm italic",
        icon
      )}
    >
      r
      <span
        className={cn(
          "absolute -bottom-px -right-px size-1.5 rounded-full border-[1.5px] border-sidebar",
          dot
        )}
      />
    </div>
  )
}

function InstanceMeta({ instance }: { instance: Instance }) {
  const { status, uptime, spend, lastActive } = instance

  if (status === "running") {
    return (
      <p className="truncate text-xs text-[#c8845a]">
        {uptime && <>up {uptime}</>}
        {uptime && spend && <> · </>}
        {spend && (
          <span className="rounded bg-[#c8845a]/10 px-1 py-px text-xs font-semibold text-[#c8845a]">
            {spend}
          </span>
        )}
      </p>
    )
  }

  if (status === "provisioning") {
    return <p className="truncate text-xs text-indigo-400">provisioning…</p>
  }

  if (status === "stopped") {
    return (
      <p className="truncate text-xs text-sidebar-foreground/40">
        {lastActive ? `last active ${lastActive}` : "stopped"}
      </p>
    )
  }

  if (status === "error") {
    return <p className="truncate text-xs text-destructive">crashed · view logs</p>
  }

  return null
}

function InstanceActions({
  instance,
  onStop,
  onStart,
  onRestart,
  onCancel,
}: Pick<InstanceItemProps, "onStop" | "onStart" | "onRestart" | "onCancel"> & {
  instance: Instance
}) {
  if (instance.status === "running") {
    return (
      <>
        <ActionButton label="Stop" onClick={onStop}><StopIcon /></ActionButton>
        <ActionButton label="Restart" onClick={onRestart}><RestartIcon /></ActionButton>
      </>
    )
  }
  if (instance.status === "provisioning") {
    return <ActionButton label="Cancel" onClick={onCancel}><CancelIcon /></ActionButton>
  }
  if (instance.status === "stopped") {
    return <ActionButton label="Start" onClick={onStart}><PlayIcon /></ActionButton>
  }
  if (instance.status === "error") {
    return <ActionButton label="Restart" onClick={onRestart}><RestartIcon /></ActionButton>
  }
  return null
}

// ─── InstanceItem ─────────────────────────────────────────────────────────────

export function InstanceItem({
  instance,
  isActive,
  onClick,
  onStop,
  onStart,
  onRestart,
  onCancel,
}: InstanceItemProps) {
  const { outline } = statusConfig[instance.status]

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onClick}
        className={cn(
          "group/item h-auto items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
          outline
        )}
      >
        <InstanceIcon status={instance.status} />

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
            {instance.name}
          </span>
          <InstanceMeta instance={instance} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <InstanceActions
            instance={instance}
            onStop={onStop}
            onStart={onStart}
            onRestart={onRestart}
            onCancel={onCancel}
          />
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// ─── AddInstanceItem ──────────────────────────────────────────────────────────

interface AddInstanceItemProps {
  onClick?: () => void
}

export function AddInstanceItem({ onClick }: AddInstanceItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onClick}
        className="h-auto items-center gap-2.5 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2 text-sidebar-foreground/40 transition-colors hover:border-sidebar-border hover:text-sidebar-foreground/60"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-sidebar-border">
          <PlusIcon />
        </div>
        <span className="text-sm font-semibold">new instance</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
