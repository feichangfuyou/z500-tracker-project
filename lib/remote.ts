function remoteConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.STORE_SECRET);
}

function headers() {
  return {
    apikey: process.env.SUPABASE_ANON_KEY!,
    authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    "content-type": "application/json",
  };
}

async function rpc(name: string, body: unknown) {
  if (!remoteConfigured()) return null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_secret: process.env.STORE_SECRET, ...(body as object) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false as const, status: res.status, text: await res.text() };
    const text = await res.text();
    if (!text) return { ok: true as const, value: null };
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: true as const, value: text };
    }
  } catch {
    return null;
  }
}

export { remoteConfigured };

export async function remoteTooMany(key: string, max: number, windowMs: number) {
  const hit = await rpc("crosscheck_hit", { p_key: key, p_max: max, p_window_ms: windowMs });
  if (!hit?.ok) return null;
  return Boolean(hit.value);
}

export async function remoteWatchGet(keys: string[]) {
  const hit = await rpc("crosscheck_watch_get", { p_keys: keys });
  if (!hit?.ok || !hit.value || typeof hit.value !== "object") return null;
  const out: Record<string, string[]> = {};
  for (const [key, mints] of Object.entries(hit.value as Record<string, unknown>)) {
    if (Array.isArray(mints)) out[key] = mints.filter((m) => typeof m === "string");
  }
  return out;
}

export async function remoteWatchPut(keys: string[], mints: string[]) {
  const hit = await rpc("crosscheck_watch_put", { p_keys: keys, p_mints: mints });
  return Boolean(hit?.ok);
}

export async function remoteLog(msg: string, ctx?: unknown) {
  await rpc("crosscheck_log", { p_msg: msg, p_ctx: ctx ?? null });
}
