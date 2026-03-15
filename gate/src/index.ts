import { Hono, type Context, type Next } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as jose from "jose";
import { apiKeys } from "@rele/db"
import { eq, and } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

type AppVariables = { userId: string };

const app = new Hono<{ Variables: AppVariables }>();

const JWKS = jose.createRemoteJWKSet(
  new URL(`${process.env.NEON_AUTH_URL}/.well-known/jwks.json`)
);

const authMiddleware = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: new URL(process.env.NEON_AUTH_URL!).origin,
    });
    if (!payload.sub) return c.json({ error: "Invalid Token" }, 401);
    c.set("userId", payload.sub);
    await next();
  } catch (err) {
    console.error("Verification failed:", err);
    return c.json({ error: "Invalid Token" }, 401);
  }
};

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ ok: true });
});

app.use("/me", authMiddleware);
app.use("/api-keys", authMiddleware);
app.use("/api-keys/*", authMiddleware);

app.get("/me", (c) => {
  return c.json({ userId: c.get("userId") });
});

app.get("/api-keys", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  return c.json(rows);
});

app.post("/api-keys", async (c) => {
  const body = await c.req.json<{ provider: string; name: string; key: string }>();
  if (!body.provider || !body.name || !body.key) {
    return c.json({ error: "provider, name, and key are required" }, 400);
  }

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: c.get("userId"),
      provider: body.provider,
      name: body.name,
      encryptedKey: body.key,
    })
    .returning({
      id: apiKeys.id,
      provider: apiKeys.provider,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
    });

  return c.json(row, 201);
});

app.delete("/api-keys/:id", async (c) => {
  const id = c.req.param("id");
  const [deleted] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, c.get("userId"))))
    .returning({ id: apiKeys.id });

  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
