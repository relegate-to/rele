import { injectIntoHtml } from "./inject";

const UPSTREAM = "http://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!;

const STRIP_HEADERS = new Set([
  "authorization",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-forwarded-user",
  "x-auth-user",
  "referer",
]);

export async function proxyHttp(
  req: Request,
  sessionToken: string | null,
): Promise<Response> {
  const url = new URL(req.url);
  url.searchParams.delete("token");
  url.searchParams.delete("jwt");

  const realOrigin = req.headers.get("origin");

  const upstreamHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      upstreamHeaders.set(key, value);
    }
  });
  upstreamHeaders.set("host", "localhost:18789");
  upstreamHeaders.set("authorization", `Bearer ${GATEWAY_TOKEN}`);
  if (realOrigin) upstreamHeaders.set("origin", "http://localhost:18789");

  const upstreamRes = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
    method: req.method,
    headers: upstreamHeaders,
    body: req.body,
    redirect: "manual",
    // @ts-ignore — Bun requires this for streaming request bodies
    duplex: "half",
  });

  const resHeaders = new Headers(upstreamRes.headers);
  resHeaders.delete("x-frame-options");
  resHeaders.delete("content-security-policy");
  resHeaders.delete("transfer-encoding");

  if (realOrigin && resHeaders.has("access-control-allow-origin")) {
    resHeaders.set("access-control-allow-origin", realOrigin);
  }

  if (sessionToken) {
    resHeaders.set(
      "set-cookie",
      `session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=None; Secure; Path=/`,
    );
  }

  const isHtml = resHeaders.get("content-type")?.includes("text/html");
  const isGet = req.method === "GET";

  if (isHtml && isGet) {
    const html = injectIntoHtml(await upstreamRes.text(), url);
    resHeaders.set("content-length", String(Buffer.byteLength(html)));
    return new Response(html, { status: upstreamRes.status, headers: resHeaders });
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}
