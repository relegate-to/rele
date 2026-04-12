import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { apiKeys } from "@rele/db";
import { db } from "../db";
import type { AppVariables } from "../middleware/auth";

const router = new Hono<{ Variables: AppVariables }>();

router.get("/", async (c) => {
  const userId = c.get("userId");
  const [row] = await db
    .select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  return c.json(row ?? null);
});

router.post("/", async (c) => {
  const body = await c.req.json<{ provider: string; key: string }>();
  if (!body.provider || !body.key) {
    return c.json({ error: "provider and key are required" }, 400);
  }

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: c.get("userId"),
      provider: body.provider,
      encryptedKey: body.key,
    })
    .onConflictDoUpdate({
      target: apiKeys.userId,
      set: {
        provider: body.provider,
        encryptedKey: body.key,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: apiKeys.id,
      provider: apiKeys.provider,
      createdAt: apiKeys.createdAt,
    });

  return c.json(row, 201);
});

router.delete("/", async (c) => {
  const [deleted] = await db
    .delete(apiKeys)
    .where(eq(apiKeys.userId, c.get("userId")))
    .returning({ id: apiKeys.id });

  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default router;
