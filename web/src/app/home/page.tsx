"use client";

import { C } from "@/lib/theme";
import UserPill from "@/components/user-pill";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.rele.to";

type HealthData = { ok: boolean } | null;
type MeData = { userId: string } | null;
type ApiKey = { id: string; provider: string; name: string; createdAt: string };

export default function HomePage() {
  const { getToken } = useAuth();

  const [health, setHealth] = useState<HealthData>(null);
  const [healthError, setHealthError] = useState(false);

  const [me, setMe] = useState<MeData>(null);
  const [meError, setMeError] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  // Form state
  const [provider, setProvider] = useState("");
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const token = await getToken();
      const r = await fetch(`${API}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setApiKeys(data);
    } catch {
      // silent — table may not exist yet in dev
    } finally {
      setKeysLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const token = await getToken();
      const r = await fetch(`${API}/api-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, name: keyName, key: keyValue }),
      });
      if (!r.ok) {
        const err = await r.json();
        setSaveError(err.error ?? "Failed to save");
        return;
      }
      setProvider("");
      setKeyName("");
      setKeyValue("");
      await fetchKeys();
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = await getToken();
      await fetch(`${API}/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // silent
    }
  };

  const inputStyle: React.CSSProperties = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: "4px",
    color: C.text,
    fontFamily: "var(--font-dm-mono), monospace",
    fontSize: "0.8rem",
    padding: "0.55rem 0.75rem",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  };

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
            marginBottom: "3.5rem",
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

        {/* API Keys section */}
        <div>
          <h2
            style={{
              fontFamily: "var(--font-lora), serif",
              fontWeight: 400,
              fontSize: "1.4rem",
              color: C.cream,
              letterSpacing: "-0.02em",
              marginBottom: "0.4rem",
            }}
          >
            API Keys
          </h2>
          <p style={{ fontSize: "0.9rem", color: C.textDim, marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Store your third-party API keys for use with rele.
          </p>

          {/* Add key form */}
          <form onSubmit={handleSave} style={{ marginBottom: "1.75rem" }}>
            <div
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: "6px",
                overflow: "hidden",
                background: C.surface,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div style={{ borderRight: `1px solid ${C.border}`, padding: "0.75rem 1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: "0.6rem",
                      color: C.muted,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      marginBottom: "0.4rem",
                    }}
                  >
                    Provider
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="openai"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    required
                  />
                </div>
                <div style={{ padding: "0.75rem 1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: "0.6rem",
                      color: C.muted,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      marginBottom: "0.4rem",
                    }}
                  >
                    Name
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="my key"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${C.border}` }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "0.6rem",
                    color: C.muted,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "0.4rem",
                  }}
                >
                  Key
                </label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="sk-..."
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div
                style={{
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: C.surfaceHi,
                }}
              >
                {saveError ? (
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: "0.7rem",
                      color: "#c0504d",
                    }}
                  >
                    {saveError}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: saving ? C.copperDim : C.copper,
                    color: C.bg,
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.45rem 1.1rem",
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "0.75rem",
                    cursor: saving ? "not-allowed" : "pointer",
                    letterSpacing: "0.05em",
                    transition: "background 0.15s",
                  }}
                >
                  {saving ? "saving…" : "Add key"}
                </button>
              </div>
            </div>
          </form>

          {/* Key list */}
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            {keysLoading ? (
              <div
                style={{
                  padding: "1.25rem",
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "0.7rem",
                  color: C.muted,
                  background: C.surface,
                }}
              >
                loading…
              </div>
            ) : apiKeys.length === 0 ? (
              <div
                style={{
                  padding: "1.25rem",
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "0.7rem",
                  color: C.muted,
                  background: C.surface,
                }}
              >
                No keys yet.
              </div>
            ) : (
              apiKeys.map((key, i) => (
                <div
                  key={key.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.9rem 1.25rem",
                    background: C.surface,
                    borderBottom: i < apiKeys.length - 1 ? `1px solid ${C.border}` : undefined,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        fontSize: "0.75rem",
                        color: C.copper,
                        marginRight: "0.75rem",
                      }}
                    >
                      {key.provider}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        fontSize: "0.8rem",
                        color: C.text,
                      }}
                    >
                      {key.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(key.id)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      borderRadius: "4px",
                      color: C.muted,
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: "0.65rem",
                      padding: "0.3rem 0.6rem",
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                    }}
                  >
                    remove
                  </button>
                </div>
              ))
            )}
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
