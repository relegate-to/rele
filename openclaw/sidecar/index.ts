import { Hono } from "hono";
import { authenticate } from "./auth";
import { proxyHttp } from "./proxy";

if (
  !process.env.NEON_AUTH_URL ||
  !process.env.USER_ID ||
  !process.env.OPENCLAW_GATEWAY_TOKEN
) {
  console.error("ERROR: Missing required environment variables");
  process.exit(1);
}

const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!;

const WS_STRIP_HEADERS = new Set([
  "authorization",
  "x-auth-user",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-forwarded-user",
  "upgrade",
  "connection",
  "host",
  "origin",
]);

const app = new Hono();

app.get("/health", async (c) => {
  try {
    const res = await fetch("http://127.0.0.1:18789/", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    await res.body?.cancel();
    return c.text("ok", 200);
  } catch {
    return c.text("not ready", 503);
  }
});

app.all("*", async (c) => {
  const authResult = await authenticate(c.req.raw);
  if (!authResult) return c.text("Unauthorized", 401);
  return proxyHttp(c.req.raw, authResult.sessionToken);
});

type WsData = {
  upstreamPath: string;
  upstreamHeaders: Record<string, string>;
  upstream: WebSocket | null;
  queue: (string | Uint8Array)[];
};

const server = Bun.serve<WsData>({
  port: 80,
  hostname: "0.0.0.0",

  async fetch(req, server) {
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const authResult = await authenticate(req);
      if (!authResult) return new Response("Unauthorized", { status: 401 });

      const url = new URL(req.url);
      url.searchParams.delete("token");
      url.searchParams.delete("jwt");
      const upstreamPath = url.pathname + url.search;

      const upstreamHeaders: Record<string, string> = {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        Origin: "https://rele.to",
        Host: "localhost:18789",
      };
      req.headers.forEach((value, key) => {
        if (!WS_STRIP_HEADERS.has(key.toLowerCase())) {
          upstreamHeaders[key] = value;
        }
      });

      server.upgrade(req, {
        data: { upstreamPath, upstreamHeaders, upstream: null, queue: [] },
      });
      return;
    }

    return app.fetch(req);
  },

  websocket: {
    open(ws) {
      const { upstreamPath, upstreamHeaders } = ws.data;
      const upstream = new WebSocket(
        `ws://127.0.0.1:18789${upstreamPath}`,
        { headers: upstreamHeaders } as any,
      );
      ws.data.upstream = upstream;

      upstream.onopen = () => {
        for (const msg of ws.data.queue) upstream.send(msg);
        ws.data.queue = [];
      };
      upstream.onmessage = (e) => ws.send(e.data);
      upstream.onclose = (e) => ws.close(e.code, e.reason);
      upstream.onerror = () => ws.close(1011, "upstream error");
    },

    message(ws, message) {
      const { upstream, queue } = ws.data;
      if (upstream?.readyState === WebSocket.OPEN) {
        upstream.send(message);
      } else {
        queue.push(message);
      }
    },

    close(ws) {
      ws.data.upstream?.close();
    },
  },
});

console.log(`Auth proxy with injection listening on :${server.port}`);
