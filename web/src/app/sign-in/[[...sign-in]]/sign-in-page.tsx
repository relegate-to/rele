"use client";

import { AuthView } from "@neondatabase/auth/react";

export default function SignInPageClient() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[--bg] text-[--text] overflow-hidden">

      {/* Noise grain */}
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0 mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%270 0 512 512%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.75%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.06%27/%3E%3C/svg%3E')] bg-[length:512px_512px]" />

      {/* Vignette */}
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(200,132,90,0.07)_0%,transparent_60%),radial-gradient(ellipse_at_50%_100%,rgba(26,21,16,0.8)_0%,transparent_70%)]" />

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
