"use client";


import { UserButton } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";

export default function UserPill() {
  const { data } = authClient.useSession();
  if (!data?.user) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "1.25rem",
        right: "1.5rem",
        zIndex: 10,
      }}
    >
      <UserButton />
    </div>
  );
}
