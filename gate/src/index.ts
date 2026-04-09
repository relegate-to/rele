import { Hono, type Context, type Next } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as jose from "jose";
import { apiKeys, machines } from "@rele/db"
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const USE_DOCKER = process.env.USE_DOCKER === "true";
const DOCKER_IMAGE = process.env.DOCKER_IMAGE ?? "rele-openclaw:latest";

const FLY_API_URL = "https://api.machines.dev/v1";
const FLY_API_TOKEN = process.env.FLY_API_TOKEN!;
const FLY_ORG = process.env.FLY_ORG!;

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

// --- Fly.io helpers ---

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

function userAppName(userId: string): string {
  const short = userId.replace(/-/g, "").slice(0, 12);
  return `rele-u-${short}`;
}

async function allocateIp(appName: string, type: string): Promise<void> {
  try {
    const gqlRes = await fetch("https://api.fly.io/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `mutation($input: AllocateIPAddressInput!) {
          allocateIpAddress(input: $input) {
            ipAddress { id address type }
          }
        }`,
        variables: {
          input: { appId: appName, type, region: "" },
        },
      }),
    });
    const gqlBody = await gqlRes.json() as any;
    if (gqlBody.errors) {
      const msg = gqlBody.errors[0]?.message ?? JSON.stringify(gqlBody.errors);
      if (!msg.includes("already")) {
        console.error(`IP allocation (${type}) error for ${appName}:`, msg);
      }
    }
  } catch (err) {
    console.error(`IP allocation (${type}) for ${appName}:`, err instanceof Error ? err.message : err);
  }
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
    }),
  });

  if (!res.ok && res.status !== 422) {
    const body = await res.text();
    throw new Error(`Failed to create user app: ${res.status}: ${body}`);
  }

  // Allocate both a shared public IPv4 (for {app}.fly.dev access)
  // and a private IPv6 (Flycast, for internal org access).
  await Promise.all([
    allocateIp(appName, "shared_v4"),
    allocateIp(appName, "private_v6"),
  ]);

  return appName;
}

async function ensureUserVolume(appName: string, region: string): Promise<string> {
  // List existing volumes for this app
  const volumes = await flyRequest(`/apps/${appName}/volumes`) as any[];
  const existing = volumes?.find((v: any) => v.name === "openclaw_data" && !v.attached_machine_id);
  if (existing) return existing.id;

  const vol = await flyRequest(`/apps/${appName}/volumes`, {
    method: "POST",
    body: JSON.stringify({
      name: "openclaw_data",
      region,
      size_gb: 5,
    }),
  });
  return vol.id;
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

// --- Docker helpers (local development) ---

async function runDocker(args: string[]): Promise<string> {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`docker ${args[0]} failed: ${stderr}`);
  }
  return stdout.trim();
}

async function dockerRun(name: string, image: string, env: Record<string, string>): Promise<{ id: string; port: number }> {
  const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  const id = await runDocker(["run", "-d", "--name", name, "-p", "18790:80", ...envArgs, image]);
  return { id, port: 18790 };
}

async function dockerPort(name: string): Promise<number> {
  // Small retry — port mapping may not be immediately available after `docker run`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const output = await runDocker(["port", name, "80"]);
      // Output: "0.0.0.0:12345" or ":::12345" (one per line, take first)
      const firstLine = output.split("\n")[0];
      const port = parseInt(firstLine.split(":").pop()!);
      if (!isNaN(port)) return port;
    } catch {
      if (attempt < 2) await Bun.sleep(500);
    }
  }
  throw new Error(`No published port 80 for container ${name}`);
}

async function dockerInspectState(name: string): Promise<string> {
  try {
    const status = await runDocker(["inspect", "--format", "{{.State.Status}}", name]);
    // Map Docker states to our states
    if (status === "running") return "started";
    if (status === "exited" || status === "dead") return "stopped";
    return status; // created, paused, restarting, etc.
  } catch {
    return "stopped";
  }
}

async function dockerStart(name: string): Promise<void> {
  await runDocker(["start", name]);
}

async function dockerStop(name: string): Promise<void> {
  await runDocker(["stop", name]);
}

async function dockerRm(name: string): Promise<void> {
  await runDocker(["rm", "-f", name]);
}

async function waitForGateway(url: string, timeoutMs = 300_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {}
    await Bun.sleep(3000);
  }
  throw new Error("Gateway health check timed out");
}

// --- Shared helpers ---

const PROVIDER_ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

async function buildMachineEnv(userId: string, extra?: Record<string, string>): Promise<{ env: Record<string, string>; gatewayToken: string }> {
  const gatewayToken = crypto.randomUUID();

  const userKeys = await db
    .select({ provider: apiKeys.provider, encryptedKey: apiKeys.encryptedKey })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  const keyEnv: Record<string, string> = {};
  for (const key of userKeys) {
    const envVar = PROVIDER_ENV_MAP[key.provider];
    if (envVar && key.encryptedKey) {
      keyEnv[envVar] = key.encryptedKey;
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

// --- Middleware ---

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

// --- Connection info (replaces the old WebSocket proxy) ---

app.get("/machines/connect-info", async (c) => {
  const userId = c.get("userId");

  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.userId, userId));

  if (!machine || machine.state === "stopped") {
    return c.json({ error: "No running machine" }, 404);
  }

  const config = machine.config as any;
  const gatewayToken = config?.env?.OPENCLAW_GATEWAY_TOKEN;

  let url: string;
  if (USE_DOCKER) {
    const dockerPort = config?.dockerPort;
    if (!dockerPort) return c.json({ error: "Docker port not found" }, 500);
    url = `ws://localhost:${dockerPort}`;
  } else {
    url = `wss://${machine.flyAppName}.fly.dev`;
  }

  return c.json({ url, gatewayToken });
});

// --- Machines ---

app.get("/machines", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(machines)
    .where(eq(machines.userId, userId));

  const updated = await Promise.all(
    rows.map(async (row) => {
      try {
        let state: string;
        if (USE_DOCKER) {
          state = await dockerInspectState(row.flyAppName);
        } else {
          const fly = await flyRequest(
            `/apps/${row.flyAppName}/machines/${row.flyMachineId}`
          );
          state = fly.state;
        }
        if (state !== row.state) {
          await db
            .update(machines)
            .set({ state, updatedAt: new Date() })
            .where(eq(machines.id, row.id));
        }
        return { ...row, state };
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

  if (USE_DOCKER) {
    const containerName = userAppName(userId);
    // In Docker mode, always use the local image — the frontend may send a
    // remote registry reference (e.g. ghcr.io/...) that doesn't exist locally.
    const image = DOCKER_IMAGE;
    const { env, gatewayToken } = await buildMachineEnv(userId, {
      ...body.config.env,
      ...(process.env.GATEWAY_REMOTE_URL ? { GATEWAY_REMOTE_URL: process.env.GATEWAY_REMOTE_URL } : {}),
    });

    let result: { id: string; port: number };
    try {
      result = await dockerRun(containerName, image, env);
    } catch (err) {
      console.error("Docker run failed:", err);
      return c.json({ error: `Docker error: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }

    const machineConfig = { image, env, dockerPort: result.port };

    const [row] = await db
      .insert(machines)
      .values({
        userId,
        flyMachineId: result.id,
        flyAppName: containerName,
        region: "local",
        state: "starting",
        config: machineConfig,
      })
      .returning();

    // Fire-and-forget: keep machine in "starting" until gateway responds,
    // then flip to "started" so the frontend knows it's actually connectable.
    waitForGateway(`http://localhost:${result.port}`)
      .then(() =>
        db
          .update(machines)
          .set({ state: "started", updatedAt: new Date() })
          .where(eq(machines.id, row.id)),
      )
      .catch((err) => console.warn("Gateway health check failed:", err));

    return c.json(row, 201);
  }

  // --- Fly.io path ---
  const region = body.region ?? "sin";

  let flyAppName: string;
  try {
    flyAppName = await ensureUserApp(userId);
  } catch (err) {
    console.error("Failed to ensure user app:", err);
    return c.json({ error: `Failed to create user app: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const { env, gatewayToken } = await buildMachineEnv(userId, {
    ...body.config.env,
    GATEWAY_REMOTE_URL: `https://${flyAppName}.fly.dev`,
  });

  let volumeId: string;
  try {
    volumeId = await ensureUserVolume(flyAppName, region);
  } catch (err) {
    console.error("Failed to ensure user volume:", err);
    return c.json({ error: `Failed to create user volume: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const machineConfig = {
    image: body.config.image,
    env,
    restart: { policy: "no" },
    guest: body.config.guest ?? {
      cpus: 2,
      memory_mb: 4096,
      cpu_kind: "performance",
    },
    metadata: { user_id: userId, fly_process_group: "user" },
    mounts: [{ volume: volumeId, path: "/home/node/.openclaw" }],
    services: [
      {
        ports: [
          { port: 80, handlers: ["http"] },
          { port: 443, handlers: ["tls", "http"] },
        ],
        protocol: "tcp",
        internal_port: 80,
        force_instance_key: null,
        auto_start_machines: false,
        auto_stop_machines: "off",
      },
    ],
  };

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
      state: "starting",
      config: machineConfig,
    })
    .returning();

  // Fire-and-forget: keep machine in "starting" until gateway responds,
  // then flip to "started" so the frontend knows it's actually connectable.
  waitForGateway(`https://${flyAppName}.fly.dev`)
    .then(() =>
      db
        .update(machines)
        .set({ state: "started", updatedAt: new Date() })
        .where(eq(machines.id, row.id)),
    )
    .catch((err) => console.warn("Gateway health check failed:", err));

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

  let state: string;
  if (USE_DOCKER) {
    state = await dockerInspectState(machine.flyAppName);
  } else {
    try {
      const fly = await flyRequest(
        `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`
      );
      state = fly.state;
    } catch (err) {
      console.error("Fly API get machine failed:", err);
      return c.json({ ...machine, flyDetails: null });
    }
  }

  if (state !== machine.state) {
    await db
      .update(machines)
      .set({ state, updatedAt: new Date() })
      .where(eq(machines.id, id));
  }

  return c.json({ ...machine, state });
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
    if (USE_DOCKER) {
      await dockerStart(machine.flyAppName);
      // Port may change after restart — re-read it
      const port = await dockerPort(machine.flyAppName);
      const config = { ...(machine.config as any), dockerPort: port };
      await db
        .update(machines)
        .set({ state: "started", config, updatedAt: new Date() })
        .where(eq(machines.id, id));
      return c.json({ ...machine, state: "started", config });
    }

    await flyRequest(
      `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/start`,
      { method: "POST" }
    );

    await db
      .update(machines)
      .set({ state: "started", updatedAt: new Date() })
      .where(eq(machines.id, id));
  } catch (err) {
    const prefix = USE_DOCKER ? "Docker" : "Fly API";
    console.error(`${prefix} start machine failed:`, err);
    return c.json({ error: `${prefix} error: ${err instanceof Error ? err.message : String(err)}` }, 502);
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
    if (USE_DOCKER) {
      await dockerStop(machine.flyAppName);
    } else {
      await flyRequest(
        `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/stop`,
        { method: "POST" }
      );
    }

    await db
      .update(machines)
      .set({ state: "stopping", updatedAt: new Date() })
      .where(eq(machines.id, id));
  } catch (err) {
    const prefix = USE_DOCKER ? "Docker" : "Fly API";
    console.error(`${prefix} stop machine failed:`, err);
    return c.json({ error: `${prefix} error: ${err instanceof Error ? err.message : String(err)}` }, 502);
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

  try {
    if (USE_DOCKER) {
      await dockerRm(machine.flyAppName);
    } else {
      await flyRequest(
        `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/stop`,
        { method: "POST" }
      );
      await flyRequest(
        `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/wait?state=stopped&timeout=30`,
        { method: "GET" }
      );
      await flyRequest(
        `/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`,
        { method: "DELETE" }
      );
    }
  } catch (err) {
    const prefix = USE_DOCKER ? "Docker" : "Fly API";
    console.error(`${prefix} delete machine failed:`, err);
    return c.json({ error: `${prefix} error: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  await db.delete(machines).where(eq(machines.id, id));

  if (!USE_DOCKER) {
    const remaining = await db
      .select({ id: machines.id })
      .from(machines)
      .where(eq(machines.userId, userId));

    if (remaining.length === 0) {
      await deleteUserApp(machine.flyAppName);
    }
  }

  return c.json({ ok: true });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
