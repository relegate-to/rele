import { db } from "../db";
import { apiKeys } from "@rele/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const PROVIDER_ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export async function buildMachineEnv(
  userId: string,
  extra?: Record<string, string>
): Promise<{ env: Record<string, string>; gatewayToken: string }> {
  const gatewayToken = crypto.randomUUID();

  const userKeys = await db
    .select({ provider: apiKeys.provider, key: apiKeys.key })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  const keyEnv: Record<string, string> = {};
  for (const key of userKeys) {
    const envVar = PROVIDER_ENV_MAP[key.provider];
    if (envVar && key.key) {
      keyEnv[envVar] = key.key;
    }
  }

  return {
    gatewayToken,
    env: {
      ...extra,
      ...keyEnv,
      USER_ID: userId,
      OPENCLAW_GATEWAY_TOKEN: gatewayToken,
      NEON_AUTH_URL: process.env.NEON_AUTH_URL!,
      OPENCLAW_STATE_DIR: "/home/node/.openclaw",
      NODE_OPTIONS: "--max-old-space-size=2048",
      NODE_ENV: "production",
    },
  };
}
