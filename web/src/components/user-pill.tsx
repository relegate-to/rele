"use client";

import { UserButton } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";
import { C } from "@/lib/theme";

export default function UserPill() {
  const { data } = authClient.useSession();
  const user = data?.user;

  if (!user) return null;

  const display = user.name || user.email || "Account";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6rem",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "999px",
        padding: "0.35rem 0.75rem 0.35rem 0.35rem",
      }}
    >
      <UserButton />
      <span
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "0.65rem",
          letterSpacing: "0.04em",
          color: C.textDim,
          whiteSpace: "nowrap",
        }}
      >
        {display}
      </span>
    </div>
  );
}
