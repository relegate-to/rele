"use client";

import { AuthView } from "@neondatabase/auth/react";
import { NoiseGrain, Vignette } from "@/components/ui/bg-effects";

export default function SignOutPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)]">
      <NoiseGrain />
      <Vignette />
      <AuthView path="sign-out" redirectTo="/" />
    </div>
  );
}
