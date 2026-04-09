"use client";

import { UserButton } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserPill() {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-13 items-center gap-2 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <Skeleton className="size-7 rounded-full shrink-0 opacity-50" />
        <Skeleton className="h-3.5 w-24 rounded  opacity-50" />
      </div>
    );
  }

  if (!data?.user) return null;

  /**
   * NOTE: Avatar sizing, colors, and the single-initial crop are
   * handled via [data-slot] overrides in globals.css to bypass
   * component encapsulation limits.
   */

  return (
    <UserButton
      align="end"
      sideOffset={8}
      size="sm"
      classNames={{
        trigger: {
          base: "flex h-13 w-full items-center gap-2 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm font-medium hover:bg-[var(--accent)]/8 hover:border-[var(--accent)]/25 transition-colors duration-150 cursor-pointer",
        },
        content: {
          base: "w-[var(--radix-popper-anchor-width,100%)] origin-top-right rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xl shadow-black/10 data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out [&_[data-slot=dropdown-menu-item]]:rounded-lg [&_[data-slot=dropdown-menu-item]:focus]:bg-[var(--surface-hi)] [&_[data-slot=dropdown-menu-item]:focus]:text-[var(--text)]",
          user: { base: "none" },
          separator: "none",
          menuItem: "rounded-lg",
        },
      }}
    />
  );
}
