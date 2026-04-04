// Self-pairs this container with the local gateway on first startup.
// Idempotent via flag file. Gateway-client (agent) auto-approval pending
// upstream fix: https://github.com/openclaw/openclaw/issues/35763

import { createRequire } from "node:module";
import { writeFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const WS = require("ws");

const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || "/home/node/.openclaw";
const PAIR_FLAG = `${STATE_DIR}/credentials/.paired`;

if (!GATEWAY_TOKEN) {
  console.error("[pair] ERROR: OPENCLAW_GATEWAY_TOKEN not set");
  process.exit(0);
}

if (existsSync(PAIR_FLAG)) {
  console.log("[pair] Already paired, skipping");
  process.exit(0);
}

console.log("[pair] Starting self-pairing...");

await new Promise((resolve) => {
  const ws = new WS("ws://localhost:18789", {
    headers: { origin: "http://127.0.0.1:18789" },
  });

  let authenticated = false;

  const done = (success, reason) => {
    clearTimeout(timer);
    try { ws.close(); } catch {}
    if (success) {
      writeFileSync(PAIR_FLAG, JSON.stringify({ pairedAt: new Date().toISOString() }));
      console.log("[pair] Pairing complete");
    } else {
      console.warn("[pair] Pairing skipped:", reason);
    }
    resolve();
  };

  const timer = setTimeout(() => done(false, "timeout"), 20_000);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!authenticated) {
      if (msg.type === "event" && msg.event === "connect.challenge") {
        ws.send(JSON.stringify({
          type: "req",
          id: "pair-connect",
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: "openclaw-control-ui", version: "0.1.0", platform: "web", mode: "webchat" },
            role: "operator",
            scopes: ["operator.read", "operator.write", "operator.pairing"],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token: GATEWAY_TOKEN },
          },
        }));
      } else if (msg.type === "res" && msg.id === "pair-connect") {
        if (msg.ok) {
          authenticated = true;
          console.log("[pair] Authenticated, requesting pair...");
          ws.send(JSON.stringify({
            type: "req",
            id: "pair-req",
            method: "node.pair.request",
            params: { nodeId: "rele-native" },
          }));
        } else {
          done(false, `auth failed: ${JSON.stringify(msg.error)}`);
        }
      }
      return;
    }

    if (msg.type === "res" && msg.id === "pair-req") {
      if (!msg.ok) { done(false, JSON.stringify(msg.error)); return; }
      const pendingId = msg.payload?.requestId ?? msg.payload?.id;
      if (msg.payload?.status === "pending" && pendingId) {
        ws.send(JSON.stringify({
          type: "req",
          id: "pair-approve",
          method: "node.pair.approve",
          params: { id: pendingId },
        }));
      } else {
        done(true);
      }
    }

    if (msg.type === "res" && msg.id === "pair-approve") {
      msg.ok ? done(true) : done(false, JSON.stringify(msg.error));
    }
  });

  ws.on("error", () => done(false, "WebSocket error"));
  ws.on("close", (code) => { if (code !== 1000) done(false, `closed ${code}`); });
});

process.exit(0);
