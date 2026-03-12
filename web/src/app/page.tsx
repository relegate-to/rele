"use client";

import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { C, EASE } from "@/lib/theme";
import { useNavigate } from "@/components/page-transition";

export default function RelePage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: "var(--font-crimson-pro), serif",
        fontWeight: 300,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Grain overlay */}
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

      {/* Warm vignette */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `radial-gradient(ellipse at 50% 0%, rgba(200,132,90,0.06) 0%, transparent 60%),
                       radial-gradient(ellipse at 50% 100%, rgba(26,21,16,0.8) 0%, transparent 70%)`,
        }}
      />

      {/* Hero */}
      <main
        style={{ position: "relative", zIndex: 1, flex: 1 }}
        className="flex flex-col items-center justify-center text-center px-6"
      >
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "0.65rem",
            color: C.copper,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: "1.75rem",
          }}
        >
          By Relegate
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.22 }}
          style={{
            fontFamily: "var(--font-lora), serif",
            fontWeight: 400,
            fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: C.cream,
            marginBottom: "1.25rem",
            maxWidth: "700px",
          }}
        >
          rele
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.34 }}
          style={{
            fontSize: "1.15rem",
            fontWeight: 300,
            color: C.textDim,
            lineHeight: 1.7,
            maxWidth: "420px",
            margin: "0 auto 2.75rem",
          }}
        >
          An AI agent that works out of the box.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.46 }}
          style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
        >
          {isSignedIn ? (
            <button
              onClick={() => navigate("/home")}
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.72rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: C.copper,
                color: C.bg,
                padding: "0.65rem 1.5rem",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Go to dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/sign-in")}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  background: C.copper,
                  color: C.bg,
                  padding: "0.65rem 1.5rem",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
              <button
                onClick={() => navigate("/sign-in")}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  border: `1px solid ${C.border}`,
                  color: C.textDim,
                  padding: "0.65rem 1.5rem",
                  borderRadius: "4px",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Sign up
              </button>
            </>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: `1px solid ${C.border}`,
          padding: "1.5rem 3rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "0.62rem",
            color: C.muted,
            letterSpacing: "0.06em",
          }}
        >
          rele — by{" "}
          <a
            href="https://relegate.to"
            style={{ color: C.copperDim, textDecoration: "none" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = C.copper)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = C.copperDim)
            }
          >
            relegate.to
          </a>
        </span>
        <div
          style={{
            display: "flex",
            gap: "2rem",
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "0.62rem",
            color: C.muted,
            letterSpacing: "0.06em",
          }}
        >
          {(
            [
              ["GitHub", "https://github.com/relegate-to/rele"],
              ["Studio", "https://relegate.to"],
              ["Contact", "mailto:sam@relegate.to"],
            ] as [string, string][]
          ).map(([label, href]) => (
            <a
              key={label}
              href={href}
              style={{ color: C.muted, textDecoration: "none" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = C.textDim)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = C.muted)
              }
            >
              {label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
