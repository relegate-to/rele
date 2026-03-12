"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { C } from "@/lib/theme";

export default function UserPill() {
  const { user } = useUser();

  if (!user) return null;

  const display =
    user.firstName ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "Account";

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
      <UserButton
        appearance={{
          elements: {
            avatarBox: {
              width: "1.5rem",
              height: "1.5rem",
            },
          },
        }}
      />
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
