"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Reveal,
  Divider,
  SectionLabel,
  SectionTitle,
  SectionSub,
  HoverBtn,
  FeatureCard,
  FormField,
  SubmitBtn,
  inputSty,
} from "@/components/ui";
import { C, EASE } from "@/lib/theme";

const FEATURES = [
  {
    icon: "✦",
    title: "Zero setup",
    desc: "Rele works out of the box. No configuration required before your first task — sensible defaults handle the rest.",
  },
  {
    icon: "◈",
    title: "Capable from day one",
    desc: "Rele ships with a pre-loaded set of capabilities. You get a working agent with a useful range from the start.",
  },
  {
    icon: "○",
    title: "Stays out of your way",
    desc: "The interface is minimal by design. Rele does the work — you set the direction.",
  },
];

export default function RelePage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", about: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <div
        style={{
          background: C.bg,
          color: C.text,
          fontFamily: "var(--font-crimson-pro), serif",
          fontWeight: 300,
        }}
        className="relative min-h-screen overflow-x-hidden"
      >
        {/* Grain overlay */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9998,
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
            zIndex: 1,
            background: `radial-gradient(ellipse at 50% 0%, rgba(200,132,90,0.06) 0%, transparent 60%),
                         radial-gradient(ellipse at 50% 100%, rgba(26,21,16,0.8) 0%, transparent 70%)`,
          }}
        />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          style={{ position: "relative", zIndex: 2 }}
          className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-28 pb-20"
        >
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.68rem",
              color: C.copper,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "2rem",
            }}
          >
            By Relegate
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
            style={{
              fontFamily: "var(--font-lora), serif",
              fontWeight: 400,
              fontSize: "clamp(3rem, 7vw, 6rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: C.cream,
              marginBottom: "1.5rem",
              maxWidth: "800px",
            }}
          >
            An AI agent that
            <br />
            <em style={{ fontStyle: "italic", color: C.copper }}>
              works out of the box.
            </em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
            style={{
              fontFamily: "var(--font-crimson-pro), serif",
              fontSize: "1.25rem",
              fontWeight: 300,
              color: C.textDim,
              lineHeight: 1.7,
              maxWidth: "540px",
              margin: "0 auto 3rem",
            }}
          >
            Sensible configuration, zero setup pain. The easiest way to get a
            capable agent running.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-4 items-center justify-center"
          >
            <HoverBtn href="#waitlist" solid>
              Join the waitlist
            </HoverBtn>
            <HoverBtn href="https://relegate.to">About Relegate</HoverBtn>
          </motion.div>
        </section>

        <Divider />

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <Reveal>
          <section
            style={{
              position: "relative",
              zIndex: 2,
              padding: "6rem 2rem",
              maxWidth: "1100px",
              margin: "0 auto",
            }}
          >
            <SectionLabel>What you get</SectionLabel>
            <SectionTitle>
              Built to{" "}
              <em style={{ fontStyle: "italic", color: C.copper }}>
                just work.
              </em>
            </SectionTitle>
            <SectionSub>
              No assembly required. Rele is configured to be useful from the
              moment you start it.
            </SectionSub>

            <div
              className="feature-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1.5px",
                background: C.border,
                border: `1px solid ${C.border}`,
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── Waitlist ─────────────────────────────────────────────────────── */}
        <Reveal>
          <section
            id="waitlist"
            style={{
              position: "relative",
              zIndex: 2,
              padding: "8rem 2rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                maxWidth: "560px",
                margin: "0 auto",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                padding: "3.5rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Top copper accent line */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "200px",
                  height: "1px",
                  background: `linear-gradient(to right, transparent, ${C.copper}, transparent)`,
                }}
              />

              <h2
                style={{
                  fontFamily: "var(--font-lora), serif",
                  fontSize: "2rem",
                  fontWeight: 400,
                  color: C.cream,
                  marginBottom: "0.75rem",
                  lineHeight: 1.2,
                }}
              >
                Early access.{" "}
                <em style={{ fontStyle: "italic", color: C.copper }}>
                  No noise.
                </em>
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-crimson-pro), serif",
                  fontSize: "1rem",
                  color: C.textDim,
                  lineHeight: 1.7,
                  marginBottom: "2.5rem",
                }}
              >
                Rele is in early development. Leave your details and we&apos;ll
                reach out when it&apos;s ready to use.
              </p>

              {submitted ? (
                <p
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "0.8rem",
                    color: C.copper,
                    letterSpacing: "0.05em",
                  }}
                >
                  You&apos;re on the list ✦
                </p>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Name">
                      <input
                        className="rele-input"
                        type="text"
                        placeholder="Your name"
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        style={inputSty()}
                      />
                    </FormField>
                    <FormField label="Email">
                      <input
                        className="rele-input"
                        type="email"
                        required
                        placeholder="you@studio.com"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        style={inputSty()}
                      />
                    </FormField>
                  </div>
                  <FormField label="What are you building?">
                    <textarea
                      className="rele-input"
                      rows={2}
                      placeholder="A game studio, a dev shop, a one-person agency..."
                      value={form.about}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, about: e.target.value }))
                      }
                      style={{ ...inputSty(), resize: "none" }}
                    />
                  </FormField>
                  <SubmitBtn>Join the waitlist →</SubmitBtn>
                </form>
              )}

              <p
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "0.62rem",
                  color: C.muted,
                  letterSpacing: "0.04em",
                  marginTop: "1rem",
                }}
              >
                No spam. No pitch deck. Just a note when it&apos;s ready.
              </p>
            </div>
          </section>
        </Reveal>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: "2rem 3rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 2,
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.65rem",
              color: C.muted,
              letterSpacing: "0.06em",
            }}
          >
            rele — by{" "}
            <Link
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
            </Link>
          </span>
          <div
            style={{
              display: "flex",
              gap: "2rem",
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.65rem",
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

      <style>{`
        @media (max-width: 767px) {
          .feature-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
