import { latestLedgerAt, type LedgerHit } from "./burn-ledger";
import type { BurnCache, Project } from "./types";

const PAID = new Set(["Gold", "Diamond"]);
export const WEBHOOK_LIVE_MS = 15 * 60 * 1000;

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

export function paidWalletSet(projects: Pick<Project, "tier" | "launchWallet">[]) {
  const wallets = new Set<string>();
  for (const p of projects) {
    if (!PAID.has(p.tier) || !p.launchWallet) continue;
    wallets.add(p.launchWallet);
  }
  return wallets;
}

export function coverageMeter(
  projects: Pick<Project, "tier" | "launchWallet">[],
  burns: Record<string, BurnCache>,
  opts?: { ledger?: LedgerHit[]; webhookAt?: number | null; now?: number },
) {
  const paid = paidWalletSet(projects);
  let paidIndexed = 0;
  let paidExhausted = 0;
  for (const wallet of paid) {
    const hit = burns[wallet];
    if (!hit) continue;
    paidIndexed += 1;
    if (hit.exhausted) paidExhausted += 1;
  }
  const webhookAt = opts?.webhookAt || null;
  const now = opts?.now ?? Date.now();
  return {
    paidWallets: paid.size,
    paidIndexed,
    paidExhausted,
    paidPending: Math.max(0, paid.size - paidIndexed),
    lastBurnAt: latestLedgerAt(opts?.ledger),
    webhookAt,
    coverageLive: Boolean(webhookAt && now - webhookAt < WEBHOOK_LIVE_MS),
  };
}
