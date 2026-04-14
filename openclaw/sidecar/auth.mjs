import { createRemoteJWKSet, jwtVerify } from "jose";
import { URL } from "node:url";

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
const USER_ID = process.env.USER_ID;

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

export async function authenticate(req) {
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
