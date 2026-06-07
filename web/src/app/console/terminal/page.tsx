"use client";

import "@xterm/xterm/css/xterm.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMachinesContext } from "../_context/machines-context";
import { useTranslation } from "../_context/i18n-context";

type WsAuth = { url: string; token: string };

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// xterm requires literal color strings, but the site uses CSS variables that
// flip with the theme. We resolve them at read time and re-resolve on theme
// change.
function buildPalette(isLight: boolean) {
  return {
    background: readVar("--bg", isLight ? "#ffffff" : "#09090b"),
    foreground: readVar("--text", isLight ? "#0f0f12" : "#fafafa"),
    cursor: readVar("--text", isLight ? "#0f0f12" : "#fafafa"),
    selectionBackground: isLight ? "#cfd6e4" : "#3a3a40",
  };
}

export default function TerminalPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { machines, loading } = useMachinesContext();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  // Re-resolve CSS vars whenever the theme flips. SSR returns fallbacks; the
  // first client render swaps them in.
  const palette = useMemo(() => buildPalette(isLight), [isLight]);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{ options: { theme: object } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const machine = machines[0] ?? null;
  const machineId = machine?.id ?? null;
  const isRunning = machine?.state === "started" || machine?.state === "running";

  // Stable refs for things we read inside the effect but don't want to retrigger it.
  const tRef = useRef(t);
  tRef.current = t;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (loading) return;
    if (!machineId) {
      routerRef.current.replace("/console/chat");
      return;
    }
    if (!isRunning) {
      setError(tRef.current("console.terminal.not-running"));
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    setError(null);

    let cancelled = false;
    let ws: WebSocket | null = null;
    let ro: ResizeObserver | null = null;
    type Disposable = { dispose: () => void };
    type TermLike = {
      cols: number;
      rows: number;
      options: { theme: object };
      open: (el: HTMLElement) => void;
      loadAddon: (a: unknown) => void;
      onData: (cb: (s: string) => void) => Disposable;
      onResize: (cb: (s: { cols: number; rows: number }) => void) => Disposable;
      write: (data: string | Uint8Array) => void;
      dispose: () => void;
    };
    type FitLike = { fit: () => void };
    let term: TermLike | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (cancelled) return;

      term = new Terminal({
        fontFamily: "var(--font-dm-mono), ui-monospace, SFMono-Regular, monospace",
        fontSize: 13,
        cursorBlink: true,
        allowProposedApi: true,
        theme: palette,
      }) as unknown as TermLike;
      termRef.current = term;
      const fit = new FitAddon() as unknown as FitLike;
      term.loadAddon(fit);
      term.open(container);
      fit.fit();

      let auth: WsAuth;
      try {
        const res = await fetch("/api/gate/ws-auth");
        if (!res.ok) throw new Error("auth failed");
        auth = (await res.json()) as WsAuth;
      } catch {
        if (!cancelled) setError(tRef.current("console.terminal.connection-failed"));
        return;
      }
      if (cancelled) return;

      const base = auth.url.replace(/\/+$/, "");
      ws = new WebSocket(`${base}/api/terminal?token=${encodeURIComponent(auth.token)}`);
      ws.binaryType = "arraybuffer";

      const sendResize = (cols: number, rows: number) => {
        if (ws?.readyState !== WebSocket.OPEN) return;
        const buf = new Uint8Array(5);
        buf[0] = 0x01;
        const dv = new DataView(buf.buffer);
        dv.setUint16(1, cols, false);
        dv.setUint16(3, rows, false);
        ws.send(buf);
      };

      ws.onopen = () => {
        if (term) sendResize(term.cols, term.rows);
      };
      ws.onmessage = (e) => {
        if (!term) return;
        if (e.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(e.data));
        } else if (typeof e.data === "string") {
          term.write(e.data);
        }
      };
      ws.onclose = () => {
        term?.write("\r\n\x1b[2m[connection closed]\x1b[0m\r\n");
      };

      const encoder = new TextEncoder();
      term.onData((d) => {
        if (ws?.readyState !== WebSocket.OPEN) return;
        const enc = encoder.encode(d);
        const buf = new Uint8Array(enc.length + 1);
        buf[0] = 0x00;
        buf.set(enc, 1);
        ws.send(buf);
      });
      term.onResize(({ cols, rows }) => sendResize(cols, rows));

      ro = new ResizeObserver(() => {
        try { fit.fit(); } catch { /* container detached */ }
      });
      ro.observe(container);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      ws?.close();
      term?.dispose();
      termRef.current = null;
    };
    // We intentionally exclude `palette` — the initial theme is captured at
    // creation, and a separate effect below swaps it on theme change without
    // tearing down the PTY session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, machineId, isRunning]);

  // Hot-swap the xterm theme when the app theme flips.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = palette;
  }, [palette]);

  if (error) {
    return (
      <div className="flex h-[100svh] items-center justify-center">
        <p className="font-mono text-sm text-[var(--status-error-text)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[100svh] w-full p-3 bg-[var(--bg)]">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
