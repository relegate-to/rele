"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMachinesContext } from "../_context/machines-context";
import { useGateway } from "../_context/gateway-context";
import { FloatingChat } from "../_components/floating-chat";
import { useTranslation } from "../_context/i18n-context";

const CANVAS_CONTEXT = `The user is viewing the rele Canvas. The canvas is a single HTML file served directly from the agent's filesystem at /home/node/.openclaw/canvas/index.html. When the user asks you to create, change, or update canvas content, edit that file in place using your file tools (direct write to file — not APIs). Write clean, self-contained HTML — all styles inline or in a <style> block, no external dependencies. Make targeted edits and preserve anything the user hasn't asked to change. Respond briefly to confirm what you did.`;

export default function CanvasPage() {
  const { t } = useTranslation();
  const { machines, loading } = useMachinesContext();
  const { subscribe } = useGateway();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const router = useRouter();
  const fetched = useRef(false);
  const pendingCanvasEdits = useRef(new Set<string>());

  const machine = machines[0] ?? null;
  const isRunning = machine?.state === "started" || machine?.state === "running";

  useEffect(() => {
    return subscribe((raw) => {
      const data = raw as Record<string, unknown>;
      if (data.type !== "event" || data.event !== "agent") return;
      const payload = data.payload as Record<string, unknown>;
      if (payload?.stream !== "tool") return;
      const d = payload.data as Record<string, unknown> | undefined;
      const name = typeof d?.name === "string" ? d.name.toLowerCase() : "";
      const toolCallId = typeof d?.toolCallId === "string" ? d.toolCallId : "";

      if (d?.phase === "start" && name !== "read") {
        const argsStr = JSON.stringify((d?.args as unknown) ?? "");
        if (argsStr.includes("canvas/index.html")) {
          pendingCanvasEdits.current.add(toolCallId);
        }
        return;
      }
      if (d?.phase !== "result") return;

      const meta = d?.meta;
      const metaHasCanvas = typeof meta === "string" && meta.includes("canvas/index.html");
      const pendingHasCanvas = toolCallId !== "" && pendingCanvasEdits.current.has(toolCallId);
      if (pendingHasCanvas) pendingCanvasEdits.current.delete(toolCallId);

      if ((metaHasCanvas || pendingHasCanvas) && name !== "read") {
        setReloadKey((k) => k + 1);
        setIframeReady(false);
      }
    });
  }, [subscribe]);

  useEffect(() => {
    if (loading) return;
    if (!machine) { router.replace("/console/chat"); return; }
    if (!isRunning) { setError(t("console.canvas.not-running")); return; }
    if (fetched.current) return;
    fetched.current = true;

    fetch("/api/gate/ws-auth")
      .then((r) => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Failed")))
      .then(({ url, token, gatewayToken }: { url: string; token: string; gatewayToken: string }) => {
        const httpBase = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
        setSrc(`${httpBase}/__openclaw__/canvas/?jwt=${encodeURIComponent(token)}&token=${encodeURIComponent(gatewayToken)}`);
      })
      .catch((e: unknown) => setError(typeof e === "string" ? e : t("console.canvas.connection-failed")));
  }, [loading, machine, isRunning, router]);

  if (error) {
    return (
      <div className="flex h-[100svh] items-center justify-center">
        <p className="font-mono text-sm text-[var(--status-error-text)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[100svh] w-full">
      {src && (
        <iframe
          key={reloadKey}
          src={`${src}&_r=${reloadKey}`}
          className="h-full w-full border-0 transition-opacity duration-500"
          style={{ opacity: iframeReady ? 1 : 0 }}
          allow="clipboard-read; clipboard-write"
          onLoad={() => setIframeReady(true)}
        />
      )}
      <FloatingChat contextPrompt={CANVAS_CONTEXT} sessionName=".canvas" />
    </div>
  );
}
