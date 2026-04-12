const BASE_URL = "https://openrouter.ai/api/v1/keys";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_MANAGEMENT_KEY!}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  return res.json();
}

export interface SubKey {
  key: string;
  hash: string;
}

export interface SubKeyUsage {
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string;
  };
}

export async function createSubKey(userId: string): Promise<SubKey> {
  const data = await request("", {
    method: "POST",
    body: JSON.stringify({ name: `rele-user-${userId}` }),
  });
  return { key: data.key, hash: data.hash };
}

export async function deleteSubKey(hash: string): Promise<void> {
  await request(`/${hash}`, { method: "DELETE" });
}

export async function getUsage(hash: string): Promise<SubKeyUsage> {
  return request(`/${hash}`);
}
