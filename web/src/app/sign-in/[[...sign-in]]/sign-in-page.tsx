"use client";

import { AuthView } from "@neondatabase/auth/react";
import { C } from "@/lib/theme";

export default function SignInPageClient() {
  return (
    <>
      <style>{`
        @keyframes page-enter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes wordmark-enter {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes card-enter {
          from { opacity: 0; transform: translateY(12px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes error-in {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .wordmark { animation: wordmark-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .auth-card { animation: card-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }

        .neon-auth-ui [data-slot="form-item"] {
          position: relative;
          padding-bottom: 1.25rem;
        }

        .neon-auth-ui [data-slot="form-message"] {
          animation: error-in 0.2s ease forwards;
        }

        /* Input focus glow */
        .neon-auth-ui [data-slot="form-control"]:focus {
          box-shadow: 0 0 0 3px rgba(200, 132, 90, 0.12);
          border-color: rgba(200, 132, 90, 0.5) !important;
        }

        /* Button hover */
        .neon-auth-ui [data-slot="card"] button[type="submit"] {
          transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .neon-auth-ui [data-slot="card"] button[type="submit"]:hover {
          box-shadow: 0 4px 20px rgba(200, 132, 90, 0.3);
          transform: translateY(-1px);
        }
        .neon-auth-ui [data-slot="card"] button[type="submit"]:active {
          transform: translateY(0);
        }

        /* Subtle card inner shadow */
        .neon-auth-ui [data-slot="card"] {
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 8px 40px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        html { overflow: hidden; }
      `}</style>

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

        {/* Auth card */}
          <AuthView
            path="sign-in"
            classNames={{
              base: "max-w-full z-1 w-[400px] z-inde",
              form: {
                base: "gap-3",
                label:
                  "text-xs font-medium uppercase tracking-widest text-muted-foreground",
                input:
                  "placeholder:text-muted-foreground/50 transition-all duration-200",
                primaryButton: "w-full font-medium tracking-wide",
                forgotPasswordLink:
                  "text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors",
                error: "text-xs text-red-400/70 absolute! bottom-0 left-0",
              },
            }}
          />
        </div>
    </>
  );
}
