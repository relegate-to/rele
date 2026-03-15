"use client";

import { AuthView } from "@neondatabase/auth/react";
import { C } from "@/lib/theme";

export default function SignInPageClient() {
  return (
    <>
      {/* Solid background */}
      <div
        style={{ position: "fixed", inset: 0, background: C.bg, zIndex: -1 }}
      />

      <div
        style={{
          background: C.bg,
          color: C.text,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          animation: "page-enter 0.3s ease-in-out both",
        }}
      >
        {/* Noise grain */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            mixBlendMode: "overlay" as React.CSSProperties["mixBlendMode"],
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
            backgroundSize: "512px 512px",
          }}
        />

        {/* Vignette */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            background: `radial-gradient(ellipse at 50% 0%, rgba(200,132,90,0.07) 0%, transparent 60%),
                         radial-gradient(ellipse at 50% 100%, rgba(26,21,16,0.8) 0%, transparent 70%)`,
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.65rem",
              color: C.copper,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "0.6rem",
            }}
          >
            By Relegate
          </p>
          <h1
            style={{
              fontFamily: "var(--font-lora), serif",
              fontWeight: 400,
              fontSize: "2.4rem",
              letterSpacing: "-0.02em",
              color: C.cream,
              lineHeight: 1,
            }}
          >
            rele
          </h1>
        </div>

        {/* Auth card — override neon vars inline on this wrapper so they win regardless of layer order */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "420px",
            maxWidth: "calc(100vw - 2rem)",
            padding: "0 1rem",
            /* Neon Auth CSS variables */
            ["--neon-background" as string]: C.bg,
            ["--neon-foreground" as string]: C.text,
            ["--neon-card" as string]: C.surface,
            ["--neon-card-foreground" as string]: C.text,
            ["--neon-popover" as string]: C.surface,
            ["--neon-popover-foreground" as string]: C.text,
            ["--neon-primary" as string]: C.copper,
            ["--neon-primary-foreground" as string]: "#1a1510",
            ["--neon-secondary" as string]: C.surfaceHi,
            ["--neon-secondary-foreground" as string]: C.text,
            ["--neon-muted" as string]: C.surface,
            ["--neon-muted-foreground" as string]: C.textDim,
            ["--neon-accent" as string]: C.surfaceHi,
            ["--neon-accent-foreground" as string]: C.text,
            ["--neon-border" as string]: C.border,
            ["--neon-input" as string]: C.border,
            ["--neon-ring" as string]: C.copper,
            ["--neon-radius" as string]: "0.375rem",
          }}
        >
          <AuthView
            path="sign-in"
            classNames={{ base: "w-full" }}
          />
        </div>
      </div>
    </>
  );
}
