import { db } from "../db";
import { apiKeys } from "@rele/db";
import { eq } from "drizzle-orm";

export const PROVIDER_ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export async function buildMachineEnv(
  userId: string,
  extra?: Record<string, string>
): Promise<{ env: Record<string, string> }> {
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
    env: {
      ...extra,
      ...keyEnv,
      USER_ID: userId,
      NEON_AUTH_URL: process.env.NEON_AUTH_URL!,
      OPENCLAW_STATE_DIR: "/home/node/.openclaw",
      NODE_OPTIONS: "--max-old-space-size=2048",
      NODE_ENV: "production",
      ALLOWED_ORIGINS: process.env.SIDECAR_ALLOWED_ORIGINS
        ?? (process.env.USE_DOCKER === "true"
          ? "http://localhost:3000,https://rele.to"
          : "https://rele.to"),
      FRAME_ANCESTORS: process.env.SIDECAR_FRAME_ANCESTORS
        ?? (process.env.USE_DOCKER === "true"
          ? "'self' http://localhost:3000 https://rele.to https://*.rele.to"
          : "'self' https://rele.to https://*.rele.to"),
    },
  };
}
