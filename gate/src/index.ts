import { Hono, type Context, type Next } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as jose from "jose";
import { apiKeys, machines } from "@rele/db"
import { eq, and } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const FLY_API_URL = "https://api.machines.dev/v1";
const FLY_API_TOKEN = process.env.FLY_API_TOKEN!;
const FLY_APP_NAME = process.env.FLY_APP_NAME!; // Set automatically by Fly at runtime

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

async function flyRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${FLY_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fly API error ${res.status}: ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ ok: true });
});

app.use("/me", authMiddleware);
app.use("/api-keys", authMiddleware);
app.use("/api-keys/*", authMiddleware);
app.use("/machines", authMiddleware);
app.use("/machines/*", authMiddleware);

app.get("/me", (c) => {
  return c.json({ userId: c.get("userId") });
});

// --- API Keys ---

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

// --- Machines ---

app.get("/machines", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(machines)
    .where(eq(machines.userId, userId));

  return c.json(rows);
});

app.post("/machines", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    region?: string;
    config: {
      image: string;
      size?: string;
      env?: Record<string, string>;
      guest?: { cpus?: number; memory_mb?: number; cpu_kind?: string };
    };
  }>();

  if (!body.config?.image) {
    return c.json({ error: "config.image is required" }, 400);
  }

  const region = body.region ?? "sin";

  const machineConfig = {
    image: body.config.image,
    env: { ...body.config.env, USER_ID: userId },
    guest: body.config.guest ?? { cpus: 1, memory_mb: 256, cpu_kind: "shared" },
    metadata: { user_id: userId },
  };

  const flyMachine = await flyRequest(`/apps/${FLY_APP_NAME}/machines`, {
    method: "POST",
    body: JSON.stringify({
      region,
      config: machineConfig,
    }),
  });

  const [row] = await db
    .insert(machines)
    .values({
      userId,
      flyMachineId: flyMachine.id,
      flyAppName: FLY_APP_NAME,
      region,
      state: flyMachine.state,
      config: machineConfig,
    })
    .returning();

  return c.json(row, 201);
});

app.get("/machines/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, userId)));

  if (!machine) return c.json({ error: "Not found" }, 404);

  // Fetch live state from Fly
  const flyMachine = await flyRequest(
    `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`
  );

  // Update local state if changed
  if (flyMachine.state !== machine.state) {
    await db
      .update(machines)
      .set({ state: flyMachine.state, updatedAt: new Date() })
      .where(eq(machines.id, id));
  }

  return c.json({ ...machine, state: flyMachine.state, flyDetails: flyMachine });
});

app.delete("/machines/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, userId)));

  if (!machine) return c.json({ error: "Not found" }, 404);

  // Stop then destroy the Fly machine
  await flyRequest(
    `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/stop`,
    { method: "POST" }
  );

  await flyRequest(
    `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`,
    { method: "DELETE" }
  );

  await db.delete(machines).where(eq(machines.id, id));

  return c.json({ ok: true });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
