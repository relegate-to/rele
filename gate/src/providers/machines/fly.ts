import { userAppName } from "../../lib/app-name";
import type { MachineProvider, CreateConfig, CreateResult, StoredMachine } from "./interface";

const FLY_API_URL = "https://api.machines.dev/v1";
const FLY_API_TOKEN = process.env.FLY_API_TOKEN!;
const FLY_ORG = process.env.FLY_ORG!;

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
    body: JSON.stringify({ app_name: appName, org_slug: FLY_ORG }),
  });

  if (!res.ok && res.status !== 422) {
    const body = await res.text();
    throw new Error(`Failed to create user app: ${res.status}: ${body}`);
  }

  await Promise.all([
    allocateIp(appName, "shared_v4"),
    allocateIp(appName, "private_v6"),
  ]);

  return appName;
}

async function ensureUserVolume(appName: string, region: string): Promise<string> {
  const volumes = await flyRequest(`/apps/${appName}/volumes`) as any[];
  const existing = volumes?.find((v: any) => v.name === "openclaw_data" && !v.attached_machine_id);
  if (existing) return existing.id;

  const vol = await flyRequest(`/apps/${appName}/volumes`, {
    method: "POST",
    body: JSON.stringify({ name: "openclaw_data", region, size_gb: 5 }),
  });
  return vol.id;
}

export class FlyProvider implements MachineProvider {
  async create(userId: string, env: Record<string, string>, config: CreateConfig): Promise<CreateResult> {
    const flyAppName = await ensureUserApp(userId);
    const region = config.region ?? "ams";
    const volumeId = await ensureUserVolume(flyAppName, region);

    const fullEnv = { ...env, GATEWAY_REMOTE_URL: `https://${flyAppName}.fly.dev` };

    const machineConfig = {
      image: config.image,
      env: fullEnv,
      restart: { policy: "no" },
      guest: config.guest ?? { cpus: 1, memory_mb: 2048, cpu_kind: "shared" },
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
          min_machines_running: 0,
        },
      ],
    };

    const flyMachine = await flyRequest(`/apps/${flyAppName}/machines`, {
      method: "POST",
      body: JSON.stringify({ region, config: machineConfig }),
    });

    return {
      flyMachineId: flyMachine.id,
      flyAppName,
      region,
      config: machineConfig,
      healthCheckUrl: `https://${flyAppName}.fly.dev`,
    };
  }

  async getState(machine: StoredMachine): Promise<string> {
    const fly = await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`);
    return fly.state;
  }

  async start(machine: StoredMachine): Promise<{ config?: Record<string, any> }> {
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/uncordon`, { method: "POST" });
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/start`, { method: "POST" });
    return {};
  }

  async stop(machine: StoredMachine): Promise<void> {
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/cordon`, { method: "POST" });
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/suspend`, { method: "POST" });
  }

  async delete(machine: StoredMachine): Promise<void> {
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/stop`, { method: "POST" });
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}/wait?state=stopped&timeout=30`);
    await flyRequest(`/apps/${machine.flyAppName}/machines/${machine.flyMachineId}`, { method: "DELETE" });
  }

  async cleanupApp(appName: string): Promise<void> {
    const res = await fetch(`${FLY_API_URL}/apps/${appName}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      console.error(`Failed to delete user app ${appName}: ${res.status}: ${body}`);
    }
  }

  connectUrl(machine: StoredMachine): string {
    return `wss://${machine.flyAppName}.fly.dev`;
  }
}
