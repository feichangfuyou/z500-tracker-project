import { publicImageUrl } from "./media";
import { mapAnsemStats, type AnsemStatsJson } from "./ansem-stats";

export { EMPTY_ANSEM_STATS, listedAirdropCaption, mapAnsemStats, type AnsemStats } from "./ansem-stats";

const ANSEM = "https://ansem.io";
const ANSEM_JSON_PATHS = new Set([
  "/api/coins",
  "/api/stats",
  "/api/boosts",
  "/api/market/ansem",
  "/api/leaderboard/projects",
]);

/** Paths the Supabase proxy will fetch from ansem.io. Keep in sync with the edge function. */
export function ansemProxyPath(path: string) {
  if (!path.startsWith("/api/") || path.includes("?") || path.includes("..")) return null;
  if (ANSEM_JSON_PATHS.has(path)) return path;
  if (/^\/api\/coins\/[A-Za-z0-9._-]{1,80}$/.test(path)) return path;
  return null;
}

function jsonBody(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json");
}

export type AnsemCoin = {
  slug: string;
  name: string;
  ticker: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  enhancedAt?: string | null;
  tier: string;
  mint: string;
  creatorWallet?: string | null;
  status?: string | null;
  priceUsd?: number | null;
  marketCapUsd?: number | null;
  volume24hUsd?: number | null;
  change24hPct?: number | null;
  airdropTotal?: number | null;
  txns24h?: number | null;
  pairAddress?: string | null;
  createdAt?: string | null;
  nsfw?: boolean;
};

type AnsemEnhanced = {
  bannerUrl?: string | null;
};

type AnsemCoinDetail = AnsemCoin & {
  enhancedAt?: string | null;
  enhancedContent?: AnsemEnhanced | null;
};

export function imageUrlFrom(raw: string | null | undefined) {
  return publicImageUrl(raw);
}

export function bannerUrlFrom(raw: {
  bannerUrl?: string | null;
  enhancedContent?: AnsemEnhanced | null;
} | null | undefined): string | null {
  const url = raw?.enhancedContent?.bannerUrl || raw?.bannerUrl || null;
  if (!url || typeof url !== "string") return null;
  return publicImageUrl(url);
}

export function enhancedAtFrom(raw: { enhancedAt?: string | null } | null | undefined): string | null {
  const at = raw?.enhancedAt;
  if (!at || typeof at !== "string") return null;
  return Number.isFinite(Date.parse(at)) ? at : null;
}

export function isEnhanced(raw: { enhancedAt?: string | null } | null | undefined) {
  return Boolean(enhancedAtFrom(raw));
}

type Cache<T> = { at: number; value: T };
const ttl = new Map<string, Cache<unknown>>();

async function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = ttl.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value as T;
  const value = await fn();
  ttl.set(key, { at: Date.now(), value });
  return value;
}

async function proxyAnsemJson<T>(path: string): Promise<T> {
  const allowed = ansemProxyPath(path);
  if (!allowed) throw new Error(`ansem ${path} not allowed`);
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error(`ansem ${path} unavailable`);
  const res = await fetch(`${base.replace(/\/$/, "")}/functions/v1/ansem-project-burns?path=${encodeURIComponent(allowed)}`, {
    headers: {
      accept: "application/json",
      apikey: key,
      authorization: `Bearer ${key}`,
    },
    next: { revalidate: 20 },
  });
  if (!res.ok || !jsonBody(res)) throw new Error(`ansem ${path} proxy ${res.status}`);
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${ANSEM}${path}`, {
      headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
      next: { revalidate: 20 },
    });
    if (res.ok && jsonBody(res)) return res.json() as Promise<T>;
  } catch {
    /* Vercel IPs get Cloudflare 403; fall through to the Supabase proxy. */
  }
  return proxyAnsemJson<T>(path);
}

export function mapTier(raw: string | null | undefined) {
  const t = (raw || "free").toLowerCase();
  if (t === "diamond") return "Diamond";
  if (t === "gold") return "Gold";
  if (t === "bronze") return "Bronze";
  if (t === "unranked") return "Unranked";
  return "Free";
}

export type AnsemCoinsFeed = {
  coins: AnsemCoin[];
  live: boolean;
  at: number;
};

export function resolveListedCoins(
  live: AnsemCoin[] | null | undefined,
  snapshot: { coins?: unknown[]; at?: number } | null | undefined,
  now = Date.now(),
): { coins: AnsemCoin[]; source: "ansem" | "cache" | "empty"; listedAt: number | null } {
  if (live?.length) return { coins: live, source: "ansem", listedAt: now };
  const snap = (snapshot?.coins || []) as AnsemCoin[];
  if (snap.length) return { coins: snap, source: "cache", listedAt: snapshot?.at || null };
  return { coins: [], source: "empty", listedAt: null };
}

export async function fetchAnsemCoinsFeed(): Promise<AnsemCoinsFeed> {
  const hit = ttl.get("coins") as Cache<AnsemCoin[]> | undefined;
  if (hit?.value.length && Date.now() - hit.at < 20_000) {
    return { coins: hit.value, live: true, at: hit.at };
  }
  try {
    const json = await getJson<{ coins: AnsemCoin[]; total?: number }>("/api/coins");
    const coins = json.coins || [];
    if (coins.length) {
      ttl.set("coins", { at: Date.now(), value: coins });
      return { coins, live: true, at: Date.now() };
    }
    if (hit?.value.length) return { coins: hit.value, live: false, at: hit.at };
    return { coins: [], live: false, at: 0 };
  } catch {
    if (hit?.value.length) return { coins: hit.value, live: false, at: hit.at };
    throw new Error("ansem /api/coins down");
  }
}

export async function fetchAnsemCoins() {
  return (await fetchAnsemCoinsFeed()).coins;
}

export async function fetchAnsemCoin(slug: string): Promise<AnsemCoinDetail | null> {
  const key = slug.trim();
  if (!key) return null;
  try {
    return await cached(`coin:${key}`, 60_000, async () => {
      const json = await getJson<{ coin?: AnsemCoinDetail }>(`/api/coins/${encodeURIComponent(key)}`);
      return json.coin || null;
    });
  } catch {
    return null;
  }
}

export type AnsemMarket = {
  priceUsd: number | null;
  solUsd: number | null;
};

export function mapAnsemMarket(json: {
  quote?: { priceUsd?: number; solUsd?: number };
} | null): AnsemMarket {
  return {
    priceUsd: json?.quote?.priceUsd ?? null,
    solUsd: json?.quote?.solUsd ?? null,
  };
}

export async function fetchAnsemMarket() {
  return cached("market-v2", 30_000, async () => {
    const json = await getJson<{
      quote?: { priceUsd?: number; marketCapUsd?: number; change24hPct?: number; solUsd?: number };
    }>("/api/market/ansem");
    return mapAnsemMarket(json);
  });
}

export async function fetchAnsemStats() {
  return cached("stats", 30_000, async () => mapAnsemStats(await getJson<AnsemStatsJson>("/api/stats")));
}

export type AnsemBoost = {
  amount: number;
  expiresAt: string;
  golden: boolean;
};

export function activeBoost(raw: AnsemBoost | null | undefined, now = Date.now()): AnsemBoost | null {
  if (!raw || !(raw.amount > 0)) return null;
  const exp = Date.parse(raw.expiresAt);
  if (!Number.isFinite(exp) || exp <= now) return null;
  return {
    amount: raw.amount,
    expiresAt: raw.expiresAt,
    golden: Boolean(raw.golden),
  };
}

export function creditedBurn(
  mint: string,
  projectBurns: Record<string, { amount: number; burners: number }>,
) {
  const hit = projectBurns[mint];
  if (hit) return { amount: hit.amount, burners: hit.burners };
  if (Object.keys(projectBurns).length) return { amount: 0, burners: 0 };
  return { amount: null as number | null, burners: null as number | null };
}

export function projectBurnsByMint(
  projects: { mint?: string; amount?: number; burners?: number }[],
) {
  const out: Record<string, { amount: number; burners: number }> = {};
  for (const p of projects) {
    if (!p.mint) continue;
    out[p.mint] = { amount: p.amount || 0, burners: p.burners || 0 };
  }
  return out;
}

/** Live ansem.io credits win; if that feed is empty we keep the last good snapshot. */
export function mergeProjectBurns(
  live: Record<string, { amount: number; burners: number }>,
  cached?: Record<string, { amount: number; burners: number }>,
) {
  if (Object.keys(live).length) return live;
  if (cached && Object.keys(cached).length) return cached;
  return live;
}

type ProjectBurnRow = { mint?: string; amount?: number; burners?: number };

let lastGoodProjectBurns: Record<string, { amount: number; burners: number }> = {};

async function fetchProjectBurnRows(): Promise<ProjectBurnRow[]> {
  const json = await getJson<{ projects?: ProjectBurnRow[] }>("/api/leaderboard/projects");
  return json.projects || [];
}

export async function fetchAnsemProjectBurns() {
  return cached("project-burns", 25_000, async () => {
    try {
      const next = projectBurnsByMint(await fetchProjectBurnRows());
      if (Object.keys(next).length) {
        lastGoodProjectBurns = next;
        return next;
      }
    } catch {
      /* keep the last good snapshot so listed burns do not flip to 0 */
    }
    return lastGoodProjectBurns;
  });
}

export async function fetchAnsemBoosts() {
  return cached("boosts", 20_000, async () => {
    const json = await getJson<{ boosts?: Record<string, AnsemBoost> }>("/api/boosts");
    return json.boosts || {};
  });
}

type PumpCoin = {
  mint?: string;
  name?: string;
  symbol?: string;
  creator?: string;
  usd_market_cap?: number;
  created_timestamp?: number;
  image_uri?: string;
  banner_uri?: string;
  nsfw?: boolean;
};

export function mapPumpCoin(c: PumpCoin): AnsemCoin | null {
  if (!c.mint) return null;
  return {
    slug: c.mint,
    name: c.name || c.symbol || "Unknown",
    ticker: c.symbol || "",
    imageUrl: imageUrlFrom(c.image_uri),
    bannerUrl: bannerUrlFrom({ bannerUrl: c.banner_uri || null }),
    enhancedAt: null,
    tier: "free",
    mint: c.mint,
    creatorWallet: c.creator || null,
    status: null,
    priceUsd: null,
    marketCapUsd: c.usd_market_cap ?? null,
    volume24hUsd: null,
    change24hPct: null,
    airdropTotal: null,
    pairAddress: null,
    createdAt: c.created_timestamp ? new Date(c.created_timestamp).toISOString() : null,
    nsfw: Boolean(c.nsfw),
  };
}

export async function fetchPumpFallbackCoins(): Promise<AnsemCoin[]> {
  const urls = [
    "https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=last_trade_timestamp",
    "https://frontend-api-v3.pump.fun/coins?offset=0&limit=50&sort=last_trade_timestamp",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as PumpCoin[];
      if (!Array.isArray(json)) continue;
      return json.map(mapPumpCoin).filter((c): c is AnsemCoin => Boolean(c));
    } catch {
      /* try next */
    }
  }
  return [];
}

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  marketCap?: number;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  pairCreatedAt?: number;
};

export function mapDexPair(pair: DexPair): AnsemCoin | null {
  const mint = pair.baseToken?.address;
  if (!mint || (pair.chainId && pair.chainId !== "solana")) return null;
  return {
    slug: mint,
    name: pair.baseToken?.name || pair.baseToken?.symbol || "Unknown",
    ticker: pair.baseToken?.symbol || "",
    imageUrl: null,
    tier: "unranked",
    mint,
    creatorWallet: null,
    status: null,
    priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
    marketCapUsd: pair.marketCap ?? null,
    volume24hUsd: pair.volume?.h24 ?? null,
    change24hPct: pair.priceChange?.h24 ?? null,
    airdropTotal: null,
    pairAddress: null,
    createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    nsfw: false,
  };
}

export async function fetchDexFallbackCoins(): Promise<AnsemCoin[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=pump", {
      headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { pairs?: DexPair[] };
    const seen = new Set<string>();
    const coins: AnsemCoin[] = [];
    for (const pair of json.pairs || []) {
      const mapped = mapDexPair(pair);
      if (!mapped || seen.has(mapped.mint)) continue;
      seen.add(mapped.mint);
      coins.push(mapped);
      if (coins.length >= 50) break;
    }
    return coins;
  } catch {
    return [];
  }
}
