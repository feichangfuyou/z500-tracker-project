import { type BurnCache } from "./types";

/** Head-refresh spacing after the first Helius pass is done. */
export const CRUISE_STALE_MS = 6 * 60 * 60 * 1000;
export const SCAN_PASS_MS = 250_000;

const TIER_RANK: Record<string, number> = {
  Diamond: 0,
  Gold: 1,
  Bronze: 2,
  Free: 3,
  Unranked: 4,
};

export type ScanTarget = {
  wallet: string;
  mint: string;
  tier: string;
  addedAt: number;
};

function freshness(burn: BurnCache | undefined, now: number, reindexLegacy = false, burst = false) {
  if (reindexLegacy && burn && burn.indexedBy !== "helius") return 0;
  if (burn && !burn.exhausted) return 0;
  if (!burn) return 1;
  // During backfill, skip already-indexed wallets so slots go to first-pass.
  if (burst) return 3;
  if (now - burn.scannedAt >= CRUISE_STALE_MS) return 2;
  return 3;
}

export function pendingFirstPass(targets: ScanTarget[], burns: Record<string, BurnCache>) {
  const seen = new Set<string>();
  let n = 0;
  for (const t of targets) {
    if (!t.wallet || seen.has(t.wallet)) continue;
    seen.add(t.wallet);
    if (burns[t.wallet]?.indexedBy !== "helius") n += 1;
  }
  return n;
}

export function scanBudget(pendingFirstPassCount = 0) {
  const rpc = process.env.SOLANA_RPC?.trim() || "";
  const paid = Boolean(rpc) && !rpc.includes("api.mainnet-beta.solana.com");
  if (pendingFirstPassCount > 0) return paid ? 80 : 16;
  return paid ? 12 : 4;
}

export function heliusPaceMs(pendingFirstPassCount = 0) {
  // Free Enhanced cap is 2 req/s; 400ms stays near that with 429 retries.
  return pendingFirstPassCount > 0 ? 550 : 300;
}

export function nextScanTargets(
  targets: ScanTarget[],
  burns: Record<string, BurnCache>,
  limit: number,
  now = Date.now(),
  reindexLegacy = false,
  burst = false,
) {
  const seen = new Set<string>();
  const unique = targets.filter((t) => {
    if (!t.wallet || seen.has(t.wallet)) return false;
    seen.add(t.wallet);
    return true;
  });

  return unique
    .map((t) => {
      const burn = burns[t.wallet];
      return {
        ...t,
        freshness: freshness(burn, now, reindexLegacy, burst),
        scannedAt: burn?.scannedAt || 0,
        tierRank: TIER_RANK[t.tier] ?? 5,
      };
    })
    .filter((t) => t.freshness < 3)
    .sort((a, b) => a.freshness - b.freshness || a.tierRank - b.tierRank || a.scannedAt - b.scannedAt || b.addedAt - a.addedAt)
    .slice(0, Math.max(0, limit));
}

export function dexRefreshBudget() {
  const rpc = process.env.SOLANA_RPC?.trim() || "";
  const paid = Boolean(rpc) && !rpc.includes("api.mainnet-beta.solana.com");
  return paid ? 90 : 30;
}
