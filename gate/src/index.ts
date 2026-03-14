import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { apiKeys } from "../../db/src/schema";
import { eq, and } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ ok: true });
});

app.use("*", clerkMiddleware());

app.get("/me", (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ userId: auth.userId });
});

// GET /api-keys — list all api keys for the authenticated user
app.get("/api-keys", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const rows = await db
    .select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, auth.userId));

  return c.json(rows);
});

// POST /api-keys — create a new api key
app.post("/api-keys", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ provider: string; name: string; key: string }>();
  if (!body.provider || !body.name || !body.key) {
    return c.json({ error: "provider, name, and key are required" }, 400);
  }

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: auth.userId,
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

// DELETE /api-keys/:id — delete a specific api key
app.delete("/api-keys/:id", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const [deleted] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, auth.userId)))
    .returning({ id: apiKeys.id });

  if (!deleted) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ ok: true });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
