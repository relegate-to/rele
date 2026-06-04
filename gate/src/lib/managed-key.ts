import { and, eq } from "drizzle-orm";
import { apiKeys } from "@rele/db";
import { db } from "../db";
import { createSubKey } from "../providers/openrouter";

export async function ensureManagedKey(userId: string): Promise<string> {
  const [existing] = await db
    .select({ key: apiKeys.key, managed: apiKeys.managed })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.managed, true)));

  if (existing) {
    return existing.key;
  }

  const sub = await createSubKey(userId);

  await db.insert(apiKeys).values({
    userId,
    provider: "openrouter",
    key: sub.key,
    managed: true,
    openrouterKeyHash: sub.hash,
  });

  return sub.key;
}
