import { request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import { URL } from "node:url";
import { injectIntoHtml } from "./inject.mjs";

const UPSTREAM = "http://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;

const HTTP_STRIP_HEADERS = new Set([
  "authorization",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-forwarded-user",
  "x-auth-user",
  "referer",
]);

const WS_STRIP_HEADERS = new Set([
  "authorization",
  "x-auth-user",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-forwarded-user",
]);

function upstreamUrl(req) {
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("token");
  url.searchParams.delete("jwt");
  return { url, path: url.pathname + url.search };
}

export function proxyHttp(req, res, sessionToken) {
  const { url, path } = upstreamUrl(req);
  const realOrigin = req.headers["origin"];

  const upstreamReq = httpRequest(
    `${UPSTREAM}${path}`,
    {
      method: req.method,
      headers: Object.fromEntries([
        ...Object.entries({
          ...req.headers,
          host: "localhost:18789",
          ...(realOrigin ? { origin: "http://localhost:18789" } : {}),
        }).filter(([k]) => !HTTP_STRIP_HEADERS.has(k.toLowerCase())),
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

      const isHtml = headers["content-type"]?.includes("text/html");
      const isGet = req.method === "GET";

      if (isHtml && isGet) {
        let body = [];
        upstreamRes.on("data", (chunk) => body.push(chunk));
        upstreamRes.on("end", () => {
          const html = injectIntoHtml(Buffer.concat(body).toString(), url);
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
    console.error("Upstream error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Bad Gateway");
    }
  });

  req.pipe(upstreamReq);
}

export function proxyWs(req, socket, head) {
  const { path } = upstreamUrl(req);

  const upstream = netConnect(18789, "127.0.0.1", () => {
    let reqLine = `${req.method} ${path} HTTP/1.1\r\n`;
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
}
