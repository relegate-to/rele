"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { C, EASE } from "@/lib/theme";

// ── Reveal ────────────────────────────────────────────────────────────────────

export function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "80px",
        background: `linear-gradient(to bottom, transparent, ${C.borderHi}, transparent)`,
        margin: "0 auto",
        position: "relative",
        zIndex: 2,
      }}
    />
  );
}

// ── Section helpers ───────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        fontSize: "0.65rem",
        color: C.copper,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        marginBottom: "1rem",
        textAlign: "center",
      }}
    >
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-lora), serif",
        fontWeight: 400,
        fontSize: "clamp(1.8rem, 4vw, 3rem)",
        color: C.cream,
        textAlign: "center",
        marginBottom: "1rem",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

export function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-crimson-pro), serif",
        fontSize: "1.1rem",
        color: C.textDim,
        textAlign: "center",
        maxWidth: "500px",
        margin: "0 auto 4rem",
        lineHeight: 1.7,
      }}
    >
      {children}
    </p>
  );
}

// ── HoverBtn ──────────────────────────────────────────────────────────────────

export function HoverBtn({
  href,
  children,
  solid = false,
}: {
  href: string;
  children: React.ReactNode;
  solid?: boolean;
}) {
  const base: React.CSSProperties = solid
    ? { background: C.copper, color: C.bg, border: "none" }
    : {
        background: "transparent",
        color: C.textDim,
        border: `1px solid ${C.borderHi}`,
      };

  const isExternal =
    href.startsWith("http") ||
    href.startsWith("mailto") ||
    href.startsWith("#");

  const style: React.CSSProperties = {
    ...base,
    padding: "0.85rem 2rem",
    fontFamily: "var(--font-dm-mono), monospace",
    fontSize: "0.75rem",
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderRadius: "2px",
    textDecoration: "none",
    display: "inline-block",
    transition: "all 0.2s",
    cursor: "pointer",
  };

  const hoverIn = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (solid) {
      e.currentTarget.style.opacity = "0.85";
      e.currentTarget.style.transform = "translateY(-1px)";
    } else {
      e.currentTarget.style.borderColor = C.copperDim;
      e.currentTarget.style.color = C.copper;
    }
  };
  const hoverOut = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (solid) {
      e.currentTarget.style.opacity = "1";
      e.currentTarget.style.transform = "none";
    } else {
      e.currentTarget.style.borderColor = C.borderHi;
      e.currentTarget.style.color = C.textDim;
    }
  };

  if (isExternal) {
    return (
      <a href={href} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
      {children}
    </Link>
  );
}

// ── FeatureCard ───────────────────────────────────────────────────────────────

export function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.surfaceHi : C.surface,
        padding: "2.5rem 2rem",
        position: "relative",
        overflow: "hidden",
        transition: "background 0.3s",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: `linear-gradient(to right, transparent, ${C.copperDim}, transparent)`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      />
      <span
        style={{
          fontSize: "1.2rem",
          marginBottom: "1rem",
          display: "block",
          color: C.copper,
        }}
      >
        {icon}
      </span>
      <div
        style={{
          fontFamily: "var(--font-lora), serif",
          fontSize: "1.1rem",
          fontWeight: 500,
          color: C.cream,
          marginBottom: "0.6rem",
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-crimson-pro), serif",
          fontSize: "0.95rem",
          color: C.textDim,
          lineHeight: 1.7,
        }}
      >
        {desc}
      </div>
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────────

export function inputSty(): React.CSSProperties {
  return {
    background: C.bgWarm,
    border: `1px solid ${C.border}`,
    borderRadius: "3px",
    color: C.text,
    fontFamily: "var(--font-crimson-pro), serif",
    fontSize: "1rem",
    padding: "0.65rem 0.9rem",
    width: "100%",
    transition: "border-color 0.2s",
  };
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        textAlign: "left",
      }}
    >
      <label
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "0.62rem",
          color: C.muted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function SubmitBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      style={{
        background: C.copper,
        color: C.bg,
        border: "none",
        padding: "0.9rem",
        fontFamily: "var(--font-dm-mono), monospace",
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        borderRadius: "3px",
        marginTop: "0.25rem",
        transition: "all 0.2s",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "0.85";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {children}
    </button>
  );
}
