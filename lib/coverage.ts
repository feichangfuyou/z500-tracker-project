import type { BurnCache, Project } from "./types";

const PAID = new Set(["Gold", "Diamond"]);

export function isListedFeed(source: "ansem" | "cache" | "pump" | "dex") {
  return source === "ansem" || source === "cache";
}

export function uniqueVerifiedBurns(burns: Record<string, BurnCache>) {
  let verifiedBurned = 0;
  let exhaustedWallets = 0;
  for (const b of Object.values(burns)) {
    verifiedBurned += b.verifiedBurn || 0;
    if (b.exhausted) exhaustedWallets += 1;
  }
  return {
    verifiedBurned,
    scannedWallets: Object.keys(burns).length,
    exhaustedWallets,
  };
}

/** Gold/Diamond launch wallets with no burn index yet. */
export function paidPendingScans(projects: Project[], burns: Record<string, BurnCache>) {
  const seen = new Set<string>();
  let paidPending = 0;
  for (const p of projects) {
    if (!PAID.has(p.tier) || !p.launchWallet || seen.has(p.launchWallet)) continue;
    seen.add(p.launchWallet);
    if (!burns[p.launchWallet]) paidPending += 1;
  }
  return paidPending;
}
