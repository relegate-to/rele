"use client";

import { UserButton } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";

export default function UserPill() {
  const { data } = authClient.useSession();
  if (!data?.user) return null;

  return (
    <UserButton
      align="end"
      sideOffset={8}
      size="sm"
      classNames={{
        trigger: {
          avatar: { base: "bg-[var(--border-hi)]" },
          base: "flex items-center gap-2 px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm font-medium hover:bg-[var(--surface-hi)] hover:border-[var(--border-hi)] transition-colors duration-150 cursor-pointer",
        },
        content: {
          user: { base: "none" },
          separator: "none",
          base: "origin-top-right min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xl shadow-black/10 data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
        },
      }}
    />
  );
}
