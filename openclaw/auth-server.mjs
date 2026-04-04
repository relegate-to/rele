import { createRemoteJWKSet, jwtVerify } from "jose";
import { createServer, request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import { URL } from "node:url";

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
const USER_ID = process.env.USER_ID;
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
const UPSTREAM = "http://127.0.0.1:18789";

if (!NEON_AUTH_URL || !USER_ID || !GATEWAY_TOKEN) {
  console.error("ERROR: Missing required environment variables");
  process.exit(1);
}

const JWKS = createRemoteJWKSet(
  new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`),
);
const issuer = new URL(NEON_AUTH_URL).origin;

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    }),
  );
}

async function verifyJwt(raw) {
  try {
    const { payload } = await jwtVerify(raw, JWKS, { issuer });
    return payload.sub === USER_ID ? payload.sub : null;
  } catch {
    return null;
  }
}

async function authenticate(req) {
  const url = new URL(req.url, "http://localhost");
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) {
    const userId = await verifyJwt(auth.slice(7));
    if (userId) return { userId, sessionToken: null };
  }
  const queryToken =
    url.searchParams.get("jwt") ?? url.searchParams.get("token");
  if (queryToken) {
    const userId = await verifyJwt(queryToken);
    if (userId) return { userId, sessionToken: queryToken };
  }
  const cookies = parseCookies(req.headers["cookie"]);
  if (cookies.session) {
    const userId = await verifyJwt(cookies.session);
    if (userId) return { userId, sessionToken: null };
  }
  return null;
}

const server = createServer(async (req, res) => {
  const tag = `[${req.method} ${req.url}]`;
  console.log(`${tag} origin=${req.headers["origin"] ?? "-"} ua=${req.headers["user-agent"] ?? "-"}`);

  // Unauthenticated health check — probes whether the gateway TCP port is open
  if (req.method === "GET" && req.url === "/health") {
    const socket = netConnect(18789, "127.0.0.1");
    socket.setTimeout(3000);
    const finish = (ok) => {
      socket.destroy();
      console.log(`${tag} health -> ${ok ? 200 : 503}`);
      res.writeHead(ok ? 200 : 503, { "Content-Type": "text/plain" });
      res.end(ok ? "ok" : "not ready");
    };
    socket.on("connect", () => finish(true));
    socket.on("error", () => finish(false));
    socket.on("timeout", () => finish(false));
    return;
  }

  const isControlUi = req.url.startsWith("/__openclaw__");

  let sessionToken = null;
  if (isControlUi) {
    const hasBearer = !!req.headers["authorization"]?.startsWith("Bearer ");
    const hasQueryToken = new URL(req.url, "http://localhost").searchParams.has("jwt") ||
      new URL(req.url, "http://localhost").searchParams.has("token");
    const hasCookie = !!req.headers["cookie"]?.includes("session=");
    console.log(`${tag} control UI auth candidates: bearer=${hasBearer} query=${hasQueryToken} cookie=${hasCookie}`);

    const authResult = await authenticate(req);
    if (!authResult) {
      console.log(`${tag} -> 401 Unauthorized`);
      res.writeHead(401, { "Content-Type": "text/plain" });
      return res.end("Unauthorized");
    }
    console.log(`${tag} authenticated userId=${authResult.userId}`);
    sessionToken = authResult.sessionToken;
  } else {
    console.log(`${tag} non-control-UI path, passing through`);
  }
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  url.searchParams.delete("jwt");
  const upstreamPath = url.pathname + url.search;

  const realOrigin = req.headers["origin"];
  const STRIP_HEADERS = [
    "authorization",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-forwarded-host",
    "x-forwarded-user",
    "x-auth-user",
    "referer",
  ];

  const upstreamReq = httpRequest(
    `${UPSTREAM}${upstreamPath}`,
    {
      method: req.method,
      headers: Object.fromEntries([
        ...Object.entries({
          ...req.headers,
          host: "localhost:18789",
          ...(realOrigin ? { origin: "http://localhost:18789" } : {}),
        }).filter(([k]) => !STRIP_HEADERS.includes(k.toLowerCase())),
        ["authorization", `Bearer ${GATEWAY_TOKEN}`],
      ]),
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];

      if (realOrigin && headers["access-control-allow-origin"]) {
        headers["access-control-allow-origin"] = realOrigin;
      }

      if (sessionToken) {
        headers["set-cookie"] =
          `session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=None; Secure; Path=/`;
      }

      // --- INJECTION LOGIC ---
      const isHtml = headers["content-type"]?.includes("text/html");
      const isGet = req.method === "GET";

      if (isHtml && isGet) {
        let body = [];
        upstreamRes.on("data", (chunk) => body.push(chunk));
        upstreamRes.on("end", () => {
          let html = Buffer.concat(body).toString();

          const script = `
          <script>
            (function() {
              const key = 'openclaw.control.settings.v1';
              const settings = JSON.parse(localStorage.getItem(key) || '{}');
              settings.theme = 'knot';
              localStorage.setItem(key, JSON.stringify(settings));
            })();
          </script>`;

          // Inject right after <head> or at the top of the file
          html = html.includes("<head>")
            ? html.replace("<head>", `<head>${script}`)
            : script + html;

          headers["content-length"] = Buffer.byteLength(html);
          res.writeHead(upstreamRes.statusCode, headers);
          res.end(html);
        });
      } else {
        res.writeHead(upstreamRes.statusCode, headers);
        upstreamRes.pipe(res);
      }
    },
  );

  upstreamReq.on("error", (err) => {
    console.error(`${tag} upstream error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Bad Gateway");
    }
  });

  req.pipe(upstreamReq);
});

// Handle WebSocket upgrades (unchanged logic)
server.on("upgrade", async (req, socket, head) => {
  const tag = `[WS ${req.url}]`;
  console.log(`${tag} upgrade origin=${req.headers["origin"] ?? "-"}`);

  if (req.url.startsWith("/__openclaw__")) {
    const result = await authenticate(req);
    if (!result) {
      console.log(`${tag} -> 401 Unauthorized`);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    console.log(`${tag} authenticated userId=${result.userId}`);
  } else {
    console.log(`${tag} non-control-UI path, passing through`);
  }

  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  url.searchParams.delete("jwt");
  const upstreamPath = url.pathname + url.search;

  const WS_STRIP_HEADERS = new Set([
    "authorization",
    "x-auth-user",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-forwarded-host",
    "x-forwarded-user",
  ]);

  const upstream = netConnect(18789, "127.0.0.1", () => {
    let reqLine = `${req.method} ${upstreamPath} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      const keyLower = key.toLowerCase();
      if (keyLower === "host") reqLine += `Host: localhost:18789\r\n`;
      else if (keyLower === "origin") reqLine += `Origin: https://rele.to\r\n`;
      else if (!WS_STRIP_HEADERS.has(keyLower))
        reqLine += `${key}: ${req.rawHeaders[i + 1]}\r\n`;
    }
    reqLine += `Authorization: Bearer ${GATEWAY_TOKEN}\r\n\r\n`;

    upstream.write(reqLine);
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(80, "0.0.0.0", () =>
  console.log("Auth proxy with injection listening on :80"),
);
