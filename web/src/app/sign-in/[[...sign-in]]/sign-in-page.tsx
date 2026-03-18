"use client";

import { AuthView } from "@neondatabase/auth/react";
import { NoiseGrain, Vignette } from "@/components/ui/bg-effects";

export default function SignInPageClient() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[--bg] text-[--text] overflow-hidden">

      <NoiseGrain />
      <Vignette />

      <AuthView
        path="sign-in"
        classNames={{
          base: "relative z-10 w-[400px] max-w-full auth-card",
          form: {
            base: "gap-3",
            label: "text-xs font-medium uppercase tracking-widest text-muted-foreground",
            input: "placeholder:text-muted-foreground/50 transition-all duration-200",
            primaryButton: "w-full font-medium tracking-wide",
            forgotPasswordLink: "text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors",
            error: "text-xs text-red-400/70 absolute! bottom-0 left-0",
          },
        }}
      />
    </div>
  );
}
