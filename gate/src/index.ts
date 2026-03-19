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
const FLY_ORG = process.env.FLY_ORG!; // Fly.io organization slug

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

// --- Per-user Fly app management ---

function userAppName(userId: string): string {
  const short = userId.replace(/-/g, "").slice(0, 12);
  return `rele-u-${short}`;
}

async function ensureUserApp(userId: string): Promise<string> {
  const appName = userAppName(userId);

  const res = await fetch(`${FLY_API_URL}/apps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_name: appName,
      org_slug: FLY_ORG,
      network: appName, // isolated network per user
    }),
  });

  // 422 means app already exists — that's fine
  if (!res.ok && res.status !== 422) {
    const body = await res.text();
    throw new Error(`Failed to create user app: ${res.status}: ${body}`);
  }

  return appName;
}

async function deleteUserApp(appName: string): Promise<void> {
  const res = await fetch(`${FLY_API_URL}/apps/${appName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    console.error(`Failed to delete user app ${appName}: ${res.status}: ${body}`);
  }
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

  // Refresh state from Fly for each machine
  const updated = await Promise.all(
    rows.map(async (row) => {
      try {
        const fly = await flyRequest(
          `/apps/${row.flyAppName}/machines/${row.flyMachineId}`
        );
        if (fly.state !== row.state) {
          await db
            .update(machines)
            .set({ state: fly.state, updatedAt: new Date() })
            .where(eq(machines.id, row.id));
        }
        return { ...row, state: fly.state };
      } catch {
        return row;
      }
    })
  );

  return c.json(updated);
});

app.post("/machines", async (c) => {
  const userId = c.get("userId");

  const existing = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.userId, userId));

  if (existing.length >= 1) {
    return c.json({ error: "Machine limit reached (max 1)" }, 409);
  }

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
    metadata: { user_id: userId, fly_process_group: "user" },
  };

  let flyAppName: string;
  try {
    flyAppName = await ensureUserApp(userId);
  } catch (err) {
    console.error("Failed to ensure user app:", err);
    return c.json({ error: `Failed to create user app: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  let flyMachine: any;
  try {
    flyMachine = await flyRequest(`/apps/${flyAppName}/machines`, {
      method: "POST",
      body: JSON.stringify({
        region,
        config: machineConfig,
      }),
    });
  } catch (err) {
    console.error("Fly API create machine failed:", err);
    return c.json({ error: `Fly API error: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const [row] = await db
    .insert(machines)
    .values({
      userId,
      flyMachineId: flyMachine.id,
      flyAppName,
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
  let flyMachine: any;
  try {
    flyMachine = await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`
    );
  } catch (err) {
    console.error("Fly API get machine failed:", err);
    return c.json({ ...machine, flyDetails: null });
  }

  // Update local state if changed
  if (flyMachine.state !== machine.state) {
    await db
      .update(machines)
      .set({ state: flyMachine.state, updatedAt: new Date() })
      .where(eq(machines.id, id));
  }

  return c.json({ ...machine, state: flyMachine.state, flyDetails: flyMachine });
});

app.post("/machines/:id/start", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, userId)));

  if (!machine) return c.json({ error: "Not found" }, 404);

  try {
    await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/start`,
      { method: "POST" }
    );

    await db
      .update(machines)
      .set({ state: "started", updatedAt: new Date() })
      .where(eq(machines.id, id));
  } catch (err) {
    console.error("Fly API start machine failed:", err);
    return c.json({ error: `Fly API error: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  return c.json({ ...machine, state: "started" });
});

app.post("/machines/:id/stop", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, userId)));

  if (!machine) return c.json({ error: "Not found" }, 404);

  try {
    await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/stop`,
      { method: "POST" }
    );

    await db
      .update(machines)
      .set({ state: "stopping", updatedAt: new Date() })
      .where(eq(machines.id, id));
  } catch (err) {
    console.error("Fly API stop machine failed:", err);
    return c.json({ error: `Fly API error: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  return c.json({ ...machine, state: "stopping" });
});

app.delete("/machines/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, userId)));

  if (!machine) return c.json({ error: "Not found" }, 404);

  // Stop the machine, wait for it to reach "stopped", then destroy it
  try {
    await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/stop`,
      { method: "POST" }
    );

    // Wait for the machine to actually stop (up to 30s)
    await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/wait?state=stopped&timeout=30`,
      { method: "GET" }
    );

    await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`,
      { method: "DELETE" }
    );
  } catch (err) {
    console.error("Fly API delete machine failed:", err);
    return c.json({ error: `Fly API error: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  await db.delete(machines).where(eq(machines.id, id));

  // If this was the user's last machine, clean up the per-user app
  const remaining = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.userId, userId));

  if (remaining.length === 0) {
    await deleteUserApp(machine.flyAppName);
  }

  return c.json({ ok: true });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
