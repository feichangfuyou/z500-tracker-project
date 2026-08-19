import { pruneBurnHits } from "./burn-index";
import type { AnsemCoin } from "./ansem";
import type { Dossier, HolderCache, Store } from "./types";

export const REMOTE_HISTORY_MAX = 18;
export const REMOTE_DOSSIER_MAX = 80;
export const REMOTE_HOLDER_MAX = 160;
export const REMOTE_DEX_MAX = 160;

export function slimListedCoin(raw: unknown): AnsemCoin | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const mint = typeof c.mint === "string" ? c.mint : "";
  if (!mint) return null;
  return {
    slug: typeof c.slug === "string" ? c.slug : mint,
    name: typeof c.name === "string" ? c.name : "Unknown",
    ticker: typeof c.ticker === "string" ? c.ticker : "",
    imageUrl: typeof c.imageUrl === "string" ? c.imageUrl : null,
    bannerUrl: typeof c.bannerUrl === "string" ? c.bannerUrl : null,
    enhancedAt: typeof c.enhancedAt === "string" ? c.enhancedAt : null,
    tier: typeof c.tier === "string" ? c.tier : "free",
    mint,
    creatorWallet: typeof c.creatorWallet === "string" ? c.creatorWallet : null,
    status: typeof c.status === "string" ? c.status : null,
    priceUsd: typeof c.priceUsd === "number" ? c.priceUsd : null,
    marketCapUsd: typeof c.marketCapUsd === "number" ? c.marketCapUsd : null,
    volume24hUsd: typeof c.volume24hUsd === "number" ? c.volume24hUsd : null,
    change24hPct: typeof c.change24hPct === "number" ? c.change24hPct : null,
    airdropTotal: typeof c.airdropTotal === "number" ? c.airdropTotal : null,
    pairAddress: typeof c.pairAddress === "string" ? c.pairAddress : null,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : null,
    nsfw: Boolean(c.nsfw),
  };
}

export function slimListedCoins(coins: unknown[] | undefined) {
  return (coins || []).map(slimListedCoin).filter((c): c is AnsemCoin => Boolean(c));
}

function newestEntries<T>(rec: Record<string, T>, max: number, at: (value: T) => number) {
  return Object.fromEntries(
    Object.entries(rec)
      .sort((a, b) => at(b[1]) - at(a[1]))
      .slice(0, max),
  );
}

/** Keep the Vercel blob under Supabase’s request limit so cron can persist. */
export function slimRemoteStore(store: Store): Store {
  const dossiers = newestEntries(store.dossiers || {}, REMOTE_DOSSIER_MAX, (d: Dossier) => d.at || 0);
  const holders = newestEntries(store.holders || {}, REMOTE_HOLDER_MAX, (h: HolderCache) => h.at || 0);
  return {
    ...store,
    watches: {},
    addLog: (store.addLog || []).slice(-40),
    reports: (store.reports || []).slice(-40),
    coinSnapshot: {
      at: store.coinSnapshot?.at || 0,
      coins: slimListedCoins(store.coinSnapshot?.coins),
    },
    rankHistory: (store.rankHistory || []).slice(0, REMOTE_HISTORY_MAX),
    dex: newestEntries(store.dex || {}, REMOTE_DEX_MAX, (d) => d.at || 0),
    dossiers: Object.fromEntries(
      Object.entries(dossiers).map(([mint, d]) => [
        mint,
        {
          ...d,
          holders: (d.holders || []).slice(0, 12),
          sameBlockBuyers: (d.sameBlockBuyers || []).slice(0, 12),
        },
      ]),
    ),
    holders: Object.fromEntries(
      Object.entries(holders).map(([mint, h]) => [mint, { ...h, holders: (h.holders || []).slice(0, 12) }]),
    ),
    burnLedger: (store.burnLedger || []).slice(0, 300),
    burnHits: pruneBurnHits(store.burnHits || {}),
    tape: (store.tape || []).slice(0, 80),
  };
}
