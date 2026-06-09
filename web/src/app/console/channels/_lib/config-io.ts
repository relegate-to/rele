// Thin wrapper around the gateway's config.* RPC surface.
//
// The gateway requires passing back the `hash` from config.get whenever you
// patch, so callers don't accidentally clobber concurrent writes. We hide
// that bookkeeping behind setChannelSlice() / patchChannelSlice().

type Rpc = (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface GatewayConfig {
  hash: string;
  value: Record<string, unknown>;
}

export async function getConfig(rpc: Rpc): Promise<GatewayConfig> {
  const res = await rpc("config.get");
  return {
    hash: String(res.hash ?? ""),
    value: (res.value ?? res) as Record<string, unknown>,
  };
}

export async function getSchema(rpc: Rpc): Promise<Record<string, unknown> | null> {
  try {
    const res = await rpc("config.schema");
    return (res.schema ?? res) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Walk the resolved schema down to channels.<id> if present. */
export function pickChannelSchema(
  schema: Record<string, unknown> | null,
  channelId: string,
): Record<string, unknown> | null {
  if (!schema) return null;
  const props = (schema.properties ?? {}) as Record<string, unknown>;
  const channels = (props.channels ?? {}) as Record<string, unknown>;
  const channelProps = (channels.properties ?? {}) as Record<string, unknown>;
  const target = channelProps[channelId];
  return target && typeof target === "object" ? (target as Record<string, unknown>) : null;
}

// Channel config changes trigger a gateway restart that drops the WS, so the
// RPC's response never arrives. `restartDelayMs` tells the gateway to ack
// first and restart after the delay — we still catch + ignore the timeout
// that fires if the disconnect beats the ack.
const RESTART_DELAY_MS = 800;

function isRestartTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /RPC timeout|connection|disconnect|closed/i.test(msg);
}

/** Replace channels.<id> entirely. */
export async function setChannelSlice(
  rpc: Rpc,
  channelId: string,
  slice: Record<string, unknown> | null,
): Promise<void> {
  const cfg = await getConfig(rpc);
  const channels = { ...((cfg.value.channels as Record<string, unknown>) ?? {}) };
  if (slice === null) {
    delete channels[channelId];
  } else {
    channels[channelId] = slice;
  }
  try {
    await rpc("config.patch", {
      raw: JSON.stringify({ channels }),
      restartDelayMs: RESTART_DELAY_MS,
      ...(cfg.hash ? { baseHash: cfg.hash } : {}),
    });
  } catch (e) {
    if (!isRestartTimeout(e)) throw e;
  }
}

/** Shallow-merge into channels.<id>. */
export async function patchChannelSlice(
  rpc: Rpc,
  channelId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const cfg = await getConfig(rpc);
  const channels = (cfg.value.channels as Record<string, unknown>) ?? {};
  const current = (channels[channelId] as Record<string, unknown>) ?? {};
  const next = { ...current, ...patch };
  try {
    await rpc("config.patch", {
      raw: JSON.stringify({ channels: { ...channels, [channelId]: next } }),
      restartDelayMs: RESTART_DELAY_MS,
      ...(cfg.hash ? { baseHash: cfg.hash } : {}),
    });
  } catch (e) {
    if (!isRestartTimeout(e)) throw e;
  }
}
