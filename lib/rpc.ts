const DEFAULTS = [
  "https://public.rpc.solanavibestation.com",
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

export const RPC_TIMEOUT_MS = 8000;

export function rpcEndpoints() {
  const preferred = process.env.SOLANA_RPC?.trim();
  const list = preferred ? [preferred, ...DEFAULTS.filter((u) => u !== preferred)] : DEFAULTS;
  return [...new Set(list)];
}

function post(url: string, body: string) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
}

function rpcErrorMessage(json: unknown): string | null {
  if (Array.isArray(json) || !json || typeof json !== "object") return null;
  const err = (json as { error?: { message?: string; code?: number } }).error;
  if (!err) return null;
  return err.message || `RPC error ${err.code ?? ""}`.trim();
}

export async function rpcPostAny(body: unknown) {
  const endpoints = rpcEndpoints();
  const payload = JSON.stringify(body);
  let lastError: Error | null = null;
  for (const url of endpoints) {
    try {
      let res = await post(url, payload);
      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, 250));
        res = await post(url, payload);
      }
      if (!res.ok) {
        lastError = new Error(`RPC ${res.status} @ ${url}`);
        continue;
      }
      const json: unknown = await res.json();
      const fail = rpcErrorMessage(json);
      if (fail) {
        lastError = new Error(`${fail} @ ${url}`);
        continue;
      }
      return json;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("RPC failed");
    }
  }
  throw lastError || new Error("All Solana RPC endpoints failed");
}
