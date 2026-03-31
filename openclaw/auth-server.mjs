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

const UPSTREAM = "http://127.0.0.1:18789";

const JWKS = createRemoteJWKSet(
  new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`)
);
const issuer = new URL(NEON_AUTH_URL).origin;

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

async function verifyJwt(raw) {
  try {
    const { payload } = await jwtVerify(raw, JWKS, { issuer });
    if (payload.sub !== USER_ID) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

async function authenticate(req) {
  const url = new URL(req.url, "http://localhost");

  // 1. Authorization header
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) {
    const userId = await verifyJwt(auth.slice(7));
    if (userId) return { userId, sessionToken: null };
  }

  // 2. ?token= query param
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    const userId = await verifyJwt(queryToken);
    if (userId) return { userId, sessionToken: queryToken };
  }

  // 3. Session cookie (for asset requests after initial auth)
  const cookies = parseCookies(req.headers["cookie"]);
  if (cookies.session) {
    const userId = await verifyJwt(cookies.session);
    if (userId) return { userId, sessionToken: null };
  }

  return null;
}

const server = createServer(async (req, res) => {
  const result = await authenticate(req);
  if (!result) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    return res.end("Unauthorized");
  }

  const { userId, sessionToken } = result;

  // Strip the token query param before forwarding
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  const upstreamPath = url.pathname + url.search;

  // Rewrite Origin to a value OpenClaw trusts (the proxy already handles auth),
  // then fix up the CORS response to match the real origin the browser sent.
  const realOrigin = req.headers["origin"];
  const STRIP_HEADERS = ["x-forwarded-for", "x-forwarded-proto", "x-forwarded-host", "x-forwarded-user", "referer"];

  const upstreamReq = httpRequest(
    `${UPSTREAM}${upstreamPath}`,
    {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries({
          ...req.headers,
          host: "localhost:18789",
          "x-auth-user": userId,
          ...(realOrigin ? { origin: "http://localhost:18789" } : {}),
        }).filter(([k]) => !STRIP_HEADERS.includes(k))
      ),
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };

      // Swap CORS origin back to the real one so the browser accepts it
      if (realOrigin && headers["access-control-allow-origin"]) {
        headers["access-control-allow-origin"] = realOrigin;
      }

      // Set session cookie when auth came from ?token= so subsequent
      // asset requests (which have no token) are also authenticated
      if (sessionToken) {
        headers["set-cookie"] = `session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/`;
      }

      res.writeHead(upstreamRes.statusCode, headers);
      upstreamRes.pipe(res);
    }
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
  const result = await authenticate(req);
  if (!result) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const { userId } = result;

  // Strip token from URL before forwarding
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  const upstreamPath = url.pathname + url.search;

  const WS_STRIP_HEADERS = new Set([
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
      if (keyLower === "host") {
        reqLine += `Host: localhost:18789\r\n`;
      } else if (keyLower === "origin") {
        reqLine += `Origin: https://rele.to\r\n`;
      } else if (!WS_STRIP_HEADERS.has(keyLower)) {
        reqLine += `${key}: ${req.rawHeaders[i + 1]}\r\n`;
      }
    }
    reqLine += `x-auth-user: ${userId}\r\n`;
    reqLine += "\r\n";

    upstream.write(reqLine);
    if (head.length > 0) upstream.write(head);

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
