import { createRemoteJWKSet, jwtVerify } from "jose";
import { createServer, request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import { URL } from "node:url";

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
if (!NEON_AUTH_URL) {
  console.error("ERROR: NEON_AUTH_URL is not set");
  process.exit(1);
}

const USER_ID = process.env.USER_ID;
if (!USER_ID) {
  console.error("ERROR: USER_ID is not set");
  process.exit(1);
}

const UPSTREAM = "http://localhost:18789";

const JWKS = createRemoteJWKSet(
  new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`),
);
const issuer = new URL(NEON_AUTH_URL).origin;

async function authenticate(req) {
  // Accept token from Authorization header or ?token= query param
  const auth = req.headers["authorization"];
  const url = new URL(req.url, "http://localhost");
  const queryToken = url.searchParams.get("token");

  let raw;
  if (auth?.startsWith("Bearer ")) {
    raw = auth.split(" ")[1];
  } else if (queryToken) {
    raw = queryToken;
  }

  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(raw, JWKS, { issuer });
    if (payload.sub !== USER_ID) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const userId = await authenticate(req);
  if (!userId) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    return res.end("Unauthorized");
  }

  // Strip the token query param before forwarding
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  const upstreamPath = url.pathname + url.search;

  // Proxy to OpenClaw
  const upstreamReq = httpRequest(
    `${UPSTREAM}${upstreamPath}`,
    {
      method: req.method,
      headers: { ...req.headers, host: "localhost:18789" },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstreamReq.on("error", (err) => {
    console.error("Upstream error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway");
    }
  });

  req.pipe(upstreamReq);
});

// Handle WebSocket upgrades
server.on("upgrade", async (req, socket, head) => {
  const userId = await authenticate(req);
  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Strip token from URL before forwarding
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  const upstreamPath = url.pathname + url.search;

  // Connect to upstream WebSocket
  const upstream = netConnect(18789, "localhost", () => {
    // Forward the upgrade request
    let reqLine = `${req.method} ${upstreamPath} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      // Skip the original host, rewrite it
      if (key.toLowerCase() === "host") {
        reqLine += `Host: localhost:18789\r\n`;
      } else {
        reqLine += `${key}: ${req.rawHeaders[i + 1]}\r\n`;
      }
    }
    reqLine += "\r\n";

    upstream.write(reqLine);
    if (head.length > 0) upstream.write(head);

    // Bidirectional pipe
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", (err) => {
    console.error("Upstream WS error:", err.message);
    socket.destroy();
  });

  socket.on("error", () => upstream.destroy());
});

server.listen(80, "0.0.0.0", () => {
  console.log("Auth proxy listening on 0.0.0.0:80");
});
