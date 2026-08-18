import type { LiveData } from "./types";

export type DexLive = {
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  change24h: number | null;
  liquidity: number | null;
  dexUrl: string | null;
  symbol: string;
  name: string;
};

type DexPair = {
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  url?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
};

function pairLive(pair: DexPair, mint: string): DexLive {
  return {
    priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
    marketCap: pair.marketCap ?? null,
    fdv: pair.fdv ?? null,
    volume24h: pair.volume?.h24 ?? null,
    change24h: pair.priceChange?.h24 ?? null,
    liquidity: pair.liquidity?.usd ?? null,
    dexUrl: pair.url || `https://dexscreener.com/solana/${mint}`,
    symbol: pair.baseToken?.symbol || "",
    name: pair.baseToken?.name || "",
  };
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function overlayDex(listed: LiveData, dex: DexLive | null | undefined): LiveData {
  if (!dex) return { ...listed, mcapSource: listed.mcapSource || "listed" };
  const price = dex.priceUsd ?? listed.priceUsd;
  const marketCap = dex.marketCap ?? listed.marketCap;
  return {
    ...listed,
    priceUsd: price,
    marketCap,
    fdv: dex.fdv ?? listed.fdv,
    volume24h: dex.volume24h ?? listed.volume24h,
    change24h: dex.change24h ?? listed.change24h,
    liquidity: dex.liquidity ?? listed.liquidity,
    dexUrl: dex.dexUrl ?? listed.dexUrl,
    symbol: dex.symbol || listed.symbol,
    name: dex.name || listed.name,
    mcapSource: dex.marketCap != null ? "dex" : "listed",
  };
}

export async function fetchDexBatch(mints: string[]): Promise<Record<string, DexLive>> {
  const unique = [...new Set(mints.map((m) => m.trim()).filter(Boolean))];
  const out: Record<string, DexLive> = {};
  for (const group of chunk(unique, 30)) {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${group.join(",")}`, {
      headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 30 },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { pairs?: DexPair[] };
    const want = new Set(group);
    for (const pair of json.pairs || []) {
      const mint = pair.baseToken?.address;
      if (!mint || !want.has(mint)) continue;
      const live = pairLive(pair, mint);
      const prev = out[mint];
      if (!prev || (live.liquidity || 0) > (prev.liquidity || 0)) out[mint] = live;
    }
  }
  return out;
}

export async function fetchDexData(mint: string): Promise<DexLive | null> {
  const batch = await fetchDexBatch([mint]);
  return batch[mint] || null;
}
