import { C } from "@/lib/theme";
import UserPill from "@/components/user-pill";

const MOCK_TASKS = [
  { id: 1, label: "Draft follow-up email to client", status: "done" },
  { id: 2, label: "Summarise meeting notes from Thursday", status: "done" },
  { id: 3, label: "Research competitors pricing page", status: "running" },
];

export default function HomePage() {
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
            Good morning.
          </h1>
          <p
            style={{
              fontSize: "1rem",
              color: C.textDim,
              marginTop: "0.5rem",
              lineHeight: 1.6,
            }}
          >
            Your agent is standing by.
          </p>
        </div>

        {/* New task input (mock) */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: "6px",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "2.5rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.7rem",
              color: C.copper,
            }}
          >
            ✦
          </span>
          <span
            style={{
              fontSize: "1rem",
              color: C.muted,
              fontStyle: "italic",
            }}
          >
            Give rele a task…
          </span>
        </div>

        {/* Recent tasks */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.62rem",
              color: C.muted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Recent
          </p>
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            {MOCK_TASKS.map((task, i) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.9rem 1.25rem",
                  borderBottom:
                    i < MOCK_TASKS.length - 1
                      ? `1px solid ${C.border}`
                      : undefined,
                  background: C.surface,
                }}
              >
                <span style={{ fontSize: "0.95rem", color: C.text }}>
                  {task.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "0.6rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color:
                      task.status === "running" ? C.copper : C.muted,
                  }}
                >
                  {task.status === "running" ? "● running" : "✓ done"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
