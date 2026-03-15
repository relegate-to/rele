"use client";

import { AuthView } from "@neondatabase/auth/react";
import { C } from "@/lib/theme";

export default function SignOutPage() {
  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AuthView path="sign-out" redirectTo="/home" />
    </div>
  );
}
