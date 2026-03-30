import { useEffect, useRef, useState } from "react"
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstanceStatus = "running" | "provisioning" | "stopping" | "stopped" | "error"

export interface Instance {
  id: string
  name: string
  status: InstanceStatus
  /** Region label — shown when running */
  uptime?: string
  /** Region label — shown when stopped */
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
  onDelete?: () => Promise<void> | void
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  InstanceStatus,
  {
    icon: string
    dot: string
    outline: string
    pulseColor: string
  }
> = {
  running: {
    icon:    "border-status-warning/30 bg-status-warning-bg text-status-warning shadow-[0_0_8px_var(--status-success-border)]",
    dot:     "bg-status-success",
    outline: "border-status-warning/30 hover:border-status-warning/50",
    pulseColor: "var(--status-success-border)",
  },
  provisioning: {
    icon:    "border-status-info/30 bg-status-info-bg text-status-info shadow-[0_0_8px_var(--status-info-border)]",
    dot:     "bg-status-info animate-pulse",
    outline: "border-status-info/30 hover:border-status-info/50",
    pulseColor: "var(--status-info-border)",
  },
  stopping: {
    icon:    "border-status-warning/30 bg-status-warning-bg text-status-warning",
    dot:     "bg-status-warning animate-pulse",
    outline: "border-status-warning/30 hover:border-status-warning/50",
    pulseColor: "transparent",
  },
  stopped: {
    icon:    "border-status-neutral-border bg-status-neutral-bg text-status-neutral",
    dot:     "bg-status-neutral",
    outline: "border-status-neutral-border hover:border-status-neutral/50",
    pulseColor: "transparent",
  },
  error: {
    icon:    "border-status-error/30 bg-status-error-bg text-status-error",
    dot:     "bg-status-error",
    outline: "border-status-error/30 hover:border-status-error/50",
    pulseColor: "var(--status-error-border)",
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

function TrashIcon() {
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
      <path d="M2 3h8M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L9 3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M6 1a5 5 0 0 1 5 5" />
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
  destructive,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  destructive?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      role="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick?.()
      }}
      className={cn(
        "flex size-6 cursor-pointer items-center justify-center rounded-[5px] border opacity-0 transition-opacity group-hover/item:opacity-100 max-md:opacity-100",
        destructive
          ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "border-sidebar-border bg-sidebar text-sidebar-foreground/50 hover:bg-sidebar-accent",
        disabled && "pointer-events-none opacity-50"
      )}
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
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg border font-sans text-sm italic transition-shadow duration-500",
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
  const { status, uptime, lastActive } = instance

  if (status === "running") {
    return (
      <p className="truncate text-xs text-status-warning">
        {uptime ?? "running"}
      </p>
    )
  }

  if (status === "provisioning") {
    return <p className="truncate text-xs text-status-info">provisioning…</p>
  }

  if (status === "stopping") {
    return <p className="truncate text-xs text-status-warning">stopping…</p>
  }

  if (status === "stopped") {
    return (
      <p className="truncate text-xs text-status-neutral">
        {lastActive ?? "stopped"}
      </p>
    )
  }

  if (status === "error") {
    return <p className="truncate text-xs text-status-error">crashed · view logs</p>
  }

  return null
}

function InstanceActions({
  instance,
  onStop,
  onStart,
  onDelete,
}: Pick<InstanceItemProps, "onStop" | "onStart" | "onDelete"> & {
  instance: Instance
}) {
  const [deleting, setDeleting] = useState(false)

  if (deleting) {
    return <SpinnerIcon />
  }

  if (instance.status === "running") {
    return <ActionButton label="Stop" onClick={onStop}><StopIcon /></ActionButton>
  }
  if (instance.status === "provisioning") {
    return <ActionButton label="Stop" onClick={onStop}><StopIcon /></ActionButton>
  }
  if (instance.status === "stopping") {
    return <SpinnerIcon />
  }
  if (instance.status === "stopped" || instance.status === "error") {
    return (
      <>
        <ActionButton label="Start" onClick={onStart}><PlayIcon /></ActionButton>
        <ActionButton
          label="Delete"
          destructive
          onClick={async () => {
            setDeleting(true)
            try {
              await onDelete?.()
            } catch {
              setDeleting(false)
            }
          }}
        >
          <TrashIcon />
        </ActionButton>
      </>
    )
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
  onDelete,
}: InstanceItemProps) {
  const { outline, pulseColor } = statusConfig[instance.status]
  const prevStatusRef = useRef(instance.status)
  const [anim, setAnim] = useState<"pop" | "shake" | null>(null)

  useEffect(() => {
    const prev = prevStatusRef.current
    if (prev === instance.status) return
    prevStatusRef.current = instance.status

    // Machine just came alive — celebrate
    if (instance.status === "running") {
      setAnim("pop")
    }
    // Stopped or errored — shake
    else if (instance.status === "stopped" || instance.status === "error") {
      setAnim("shake")
    }
    // Everything else (provisioning) — shimmer handles it
    else {
      return
    }

    const timeout = setTimeout(() => setAnim(null), 600)
    return () => clearTimeout(timeout)
  }, [instance.status])

  const isTransitioning = instance.status === "provisioning"

  const animClass =
    anim === "pop"   ? "animate-[status-pop_0.55s_ease-out]" :
    anim === "shake" ? "animate-[status-shake_0.4s_ease-out]" :
    null

  return (
    <SidebarMenuItem>
      <div
        className={cn("rounded-lg", animClass)}
        style={anim === "pop" ? { "--status-pulse-color": pulseColor } as React.CSSProperties : undefined}
        key={anim ? `${instance.status}-${anim}` : undefined}
      >
      <SidebarMenuButton
        isActive={isActive}
        onClick={onClick}
        className={cn(
          "group/item relative h-auto items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors overflow-hidden",
          outline
        )}
      >
        {isTransitioning && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 w-[50%] animate-[shimmer_1.8s_ease-in-out_infinite] skew-x-[-20deg]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, transparent 38%, var(--status-info-border) 40%, var(--status-info-border) 60%, transparent 62%, transparent 100%)",
            }}
          />
        )}
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
            onDelete={onDelete}
          />
        </div>
      </SidebarMenuButton>
      </div>
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
