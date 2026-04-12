import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { machines } from "@rele/db";
import { db } from "../db";
import { waitForGateway } from "../lib/gateway";
import type { MachineProvider } from "../providers/machines/interface";
import { buildMachineEnv } from "../lib/machine-env";
import { ensureManagedKey } from "../lib/managed-key";
import type { AppVariables } from "../middleware/auth";

export function createMachineRoutes(provider: MachineProvider) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/connect-info", async (c) => {
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

    return c.json({ url: provider.connectUrl(machine), gatewayToken });
  });

  router.get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await db
      .select()
      .from(machines)
      .where(eq(machines.userId, userId));

    const updated = await Promise.all(
      rows.map(async (row) => {
        try {
          const state = await provider.getState(row);
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

  router.post("/", async (c) => {
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
      name?: string;
      icon?: string;
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

    await ensureManagedKey(userId);
    const { env } = await buildMachineEnv(userId, body.config.env);

    let result;
    try {
      result = await provider.create(userId, env, {
        image: body.config.image,
        region: body.region,
        guest: body.config.guest,
      });
    } catch (err) {
      console.error("Provider create failed:", err);
      return c.json({ error: `Failed to create machine: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }

    const [row] = await db
      .insert(machines)
      .values({
        userId,
        flyMachineId: result.flyMachineId,
        flyAppName: result.flyAppName,
        region: result.region,
        state: "starting",
        config: {
          ...result.config,
          ...(body.name ? { name: body.name } : {}),
          ...(body.icon ? { icon: body.icon } : {}),
        },
      })
      .returning();

    waitForGateway(result.healthCheckUrl)
      .then(() =>
        db
          .update(machines)
          .set({ state: "started", updatedAt: new Date() })
          .where(eq(machines.id, row.id)),
      )
      .catch((err) => console.warn("Gateway health check failed:", err));

    return c.json(row, 201);
  });

  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");

    const [machine] = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)));

    if (!machine) return c.json({ error: "Not found" }, 404);

    let state: string;
    try {
      state = await provider.getState(machine);
    } catch (err) {
      console.error("Provider getState failed:", err);
      return c.json({ ...machine, flyDetails: null });
    }

    if (state !== machine.state) {
      await db
        .update(machines)
        .set({ state, updatedAt: new Date() })
        .where(eq(machines.id, id));
    }

    return c.json({ ...machine, state });
  });

  router.post("/:id/start", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");

    const [machine] = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)));

    if (!machine) return c.json({ error: "Not found" }, 404);

    try {
      const { config } = await provider.start(machine);
      const update: Record<string, any> = { state: "started", updatedAt: new Date() };
      if (config) update.config = config;
      await db.update(machines).set(update).where(eq(machines.id, id));
      return c.json({ ...machine, state: "started", ...(config ? { config } : {}) });
    } catch (err) {
      console.error("Provider start failed:", err);
      return c.json({ error: `Failed to start machine: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }
  });

  router.post("/:id/stop", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");

    const [machine] = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)));

    if (!machine) return c.json({ error: "Not found" }, 404);

    try {
      await provider.stop(machine);
      await db
        .update(machines)
        .set({ state: "stopping", updatedAt: new Date() })
        .where(eq(machines.id, id));
    } catch (err) {
      console.error("Provider stop failed:", err);
      return c.json({ error: `Failed to stop machine: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }

    return c.json({ ...machine, state: "stopping" });
  });

  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");

    const [machine] = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)));

    if (!machine) return c.json({ error: "Not found" }, 404);

    try {
      await provider.delete(machine);
    } catch (err) {
      console.error("Provider delete failed:", err);
      return c.json({ error: `Failed to delete machine: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }

    await db.delete(machines).where(eq(machines.id, id));

    const remaining = await db
      .select({ id: machines.id })
      .from(machines)
      .where(eq(machines.userId, userId));

    if (remaining.length === 0) {
      await provider.cleanupApp(machine.flyAppName);
    }

    return c.json({ ok: true });
  });

  return router;
}
