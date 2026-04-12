import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { apiKeys } from "@rele/db";
import { db } from "../db";
import { deleteSubKey } from "../providers/openrouter";
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
  const userId = c.get("userId");
  const body = await c.req.json<{ provider: string; key: string }>();
  if (!body.provider || !body.key) {
    return c.json({ error: "provider and key are required" }, 400);
  }

  const [existing] = await db
    .select({ managed: apiKeys.managed, openrouterKeyHash: apiKeys.openrouterKeyHash })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  if (existing?.managed && existing.openrouterKeyHash) {
    try {
      await deleteSubKey(existing.openrouterKeyHash);
    } catch (err) {
      console.error("Failed to delete managed sub-key:", err);
    }
  }

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId,
      provider: body.provider,
      key: body.key,
      managed: false,
      openrouterKeyHash: null,
    })
    .onConflictDoUpdate({
      target: apiKeys.userId,
      set: {
        provider: body.provider,
        key: body.key,
        managed: false,
        openrouterKeyHash: null,
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
    .returning({ managed: apiKeys.managed, openrouterKeyHash: apiKeys.openrouterKeyHash });

  if (!deleted) return c.json({ error: "Not found" }, 404);

  if (deleted.managed && deleted.openrouterKeyHash) {
    try {
      await deleteSubKey(deleted.openrouterKeyHash);
    } catch (err) {
      console.error("Failed to delete managed sub-key:", err);
    }
  }

  return c.json({ ok: true });
});

export default router;
