import { createServer, request as httpRequest } from "node:http";
import { authenticate } from "./auth.mjs";
import { proxyHttp, proxyWs } from "./proxy.mjs";
import { handleSkillsApi } from "./skills.mjs";

if (
  !process.env.NEON_AUTH_URL ||
  !process.env.USER_ID ||
  !process.env.OPENCLAW_GATEWAY_TOKEN
) {
  console.error("ERROR: Missing required environment variables");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  // Unauthenticated health check — probes whether the gateway HTTP server is ready
  if (req.method === "GET" && req.url === "/health") {
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      probe.destroy();
      res.writeHead(ok ? 200 : 503, { "Content-Type": "text/plain" });
      res.end(ok ? "ok" : "not ready");
    };
    const probe = httpRequest(
      { host: "127.0.0.1", port: 18789, path: "/", method: "HEAD" },
      (r) => {
        r.resume();
        finish(true);
      },
    );
    probe.setTimeout(3000);
    probe.on("error", () => finish(false));
    probe.on("timeout", () => finish(false));
    probe.end();
    return;
  }

  const authResult = await authenticate(req);
  if (!authResult) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    return res.end("Unauthorized");
  }

  // Skills / gateway management — handled locally, not proxied upstream.
  const reqPath = new URL(req.url, "http://localhost").pathname;
  if (
    reqPath.startsWith("/api/skills") ||
    reqPath.startsWith("/api/gateway")
  ) {
    return handleSkillsApi(req, res);
  }

  proxyHttp(req, res, authResult.sessionToken);
});

server.on("upgrade", async (req, socket, head) => {
  const result = await authenticate(req);
  if (!result) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  proxyWs(req, socket, head);
});

server.listen(80, "0.0.0.0", () =>
  console.log("Auth proxy with injection listening on :80"),
);
