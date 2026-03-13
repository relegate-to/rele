"use client";

import { C } from "@/lib/theme";
import UserPill from "@/components/user-pill";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.rele.to";

type HealthData = { ok: boolean } | null;
type MeData = { userId: string } | null;

export default function HomePage() {
  const { getToken } = useAuth();

  const [health, setHealth] = useState<HealthData>(null);
  const [healthError, setHealthError] = useState(false);

  const [me, setMe] = useState<MeData>(null);
  const [meError, setMeError] = useState(false);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealthError(true));
  }, []);

  useEffect(() => {
    getToken().then((token) =>
      fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then(setMe)
        .catch(() => setMeError(true))
    );
  }, [getToken]);

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        fontFamily: "var(--font-crimson-pro), serif",
        fontWeight: 300,
      }}
    >
      {/* User pill */}
      <div
        style={{
          position: "fixed",
          top: "1.25rem",
          right: "1.5rem",
          zIndex: 10,
        }}
      >
        <UserPill />
      </div>

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

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "720px",
          margin: "0 auto",
          padding: "5rem 2rem 4rem",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "3.5rem" }}>
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.65rem",
              color: C.copper,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            rele
          </p>
          <h1
            style={{
              fontFamily: "var(--font-lora), serif",
              fontWeight: 400,
              fontSize: "2rem",
              color: C.cream,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Backend status
          </h1>
          <p
            style={{
              fontSize: "1rem",
              color: C.textDim,
              marginTop: "0.5rem",
              lineHeight: 1.6,
            }}
          >
            Checking connectivity to{" "}
            <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "0.85rem" }}>
              {process.env.NEXT_PUBLIC_API_URL ?? "api.rele.to"}
            </span>
          </p>
        </div>

        {/* Status rows */}
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          {/* /health */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.9rem 1.25rem",
              borderBottom: `1px solid ${C.border}`,
              background: C.surface,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.8rem",
                color: C.text,
              }}
            >
              GET /health
            </span>
            <StatusBadge
              loading={!health && !healthError}
              error={healthError}
              value={health ? JSON.stringify(health) : null}
            />
          </div>

          {/* /me */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.9rem 1.25rem",
              background: C.surface,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.8rem",
                color: C.text,
              }}
            >
              GET /me
            </span>
            <StatusBadge
              loading={!me && !meError}
              error={meError}
              value={me ? JSON.stringify(me) : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  loading,
  error,
  value,
}: {
  loading: boolean;
  error: boolean;
  value: string | null;
}) {
  const monoStyle: React.CSSProperties = {
    fontFamily: "var(--font-dm-mono), monospace",
    fontSize: "0.65rem",
    letterSpacing: "0.06em",
  };

  if (loading) {
    return (
      <span style={{ ...monoStyle, color: C.muted }}>
        waiting…
      </span>
    );
  }

  if (error) {
    return (
      <span style={{ ...monoStyle, color: "#c0504d" }}>
        ✕ error
      </span>
    );
  }

  return (
    <span style={{ ...monoStyle, color: C.copper }}>
      {value}
    </span>
  );
}
