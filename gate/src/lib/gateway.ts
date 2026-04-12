export async function waitForGateway(url: string, timeoutMs = 300_000): Promise<void> {
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
