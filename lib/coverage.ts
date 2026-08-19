import { latestLedgerAt, type LedgerHit } from "./burn-ledger";
import { isIndexMint, type BurnCache, type Project } from "./types";

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

/** Gold/Diamond launch wallets with no finished burn index yet. */
export function paidPendingScans(projects: Project[], burns: Record<string, BurnCache>) {
  const seen = new Set<string>();
  let paidPending = 0;
  for (const p of projects) {
    if (!PAID.has(p.tier) || !p.launchWallet || seen.has(p.launchWallet)) continue;
    seen.add(p.launchWallet);
    if (!burns[p.launchWallet]?.exhausted) paidPending += 1;
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

export type BurnCoverageStatus = "complete" | "partial" | "unlabeled" | "unchecked" | "none";

export type BurnCoverage = {
  listed: number | null;
  verified: number | null;
  pct: number | null;
  burners: number | null;
  status: BurnCoverageStatus;
};

/** How much of z500’s credited $ANSEM we independently assigned to this coin. */
export function burnCoverage(p: {
  listedBurn?: number | null;
  listedBurners?: number | null;
  verifiedBurn?: number | null;
  tier?: string;
}): BurnCoverage {
  const listed = p.listedBurn ?? null;
  const verified = p.verifiedBurn ?? null;
  const burners = p.listedBurners ?? null;
  const paid = p.tier === "Gold" || p.tier === "Diamond";
  const listedAmt = listed ?? 0;
  const verifiedAmt = verified ?? 0;
  const pct = listedAmt > 0 && verified != null ? Math.min(1, Math.max(0, verifiedAmt / listedAmt)) : null;

  if (listed == null && verified == null) {
    return { listed, verified, pct, burners, status: paid ? "unchecked" : "none" };
  }

  const extraBurners = (burners ?? 0) > 1;
  const missing = listedAmt > 0 && (verified == null || verifiedAmt + 1 < listedAmt * 0.95);
  if (listedAmt > 0 && pct != null && pct >= 0.95) {
    return { listed, verified, pct, burners, status: "complete" };
  }
  if (extraBurners || (missing && verifiedAmt < listedAmt * 0.25)) {
    return { listed, verified, pct, burners, status: "unlabeled" };
  }
  if (listedAmt > 0 && pct != null && pct < 0.75) {
    return { listed, verified, pct, burners, status: "partial" };
  }
  if (listedAmt <= 0 && verifiedAmt <= 0) {
    return { listed, verified, pct, burners, status: "none" };
  }
  return { listed, verified, pct: pct ?? (verifiedAmt > 0 ? 1 : null), burners, status: "complete" };
}

export function unlabeledLedger(ledger: LedgerHit[] | undefined) {
  let unlabeledBurned = 0;
  let unlabeledHits = 0;
  for (const hit of ledger || []) {
    if (hit.labeled !== false) continue;
    unlabeledHits += 1;
    unlabeledBurned += hit.amount || 0;
  }
  return { unlabeledBurned, unlabeledHits };
}

export function listedBurnTotal(projects: { mint: string; listedBurn?: number | null }[]) {
  let listedBurned = 0;
  for (const p of projects) {
    if (isIndexMint(p.mint)) continue;
    listedBurned += p.listedBurn || 0;
  }
  return listedBurned;
}

export function burnVerifiedPct(verifiedBurned: number, listedBurned: number) {
  if (!(listedBurned > 0)) return null;
  return Math.min(1, Math.max(0, verifiedBurned / listedBurned));
}

/** Share of ansem.io credited $ANSEM we independently assigned to the same coins. */
export function ansemAccuracy(
  projects: { mint: string; listedBurn?: number | null; verifiedBurn?: number | null }[],
) {
  let listed = 0;
  let matched = 0;
  let verified = 0;
  let coins = 0;
  let coinsMatched = 0;
  for (const p of projects) {
    if (isIndexMint(p.mint)) continue;
    const credited = p.listedBurn;
    if (!(credited != null && credited > 0)) continue;
    coins += 1;
    listed += credited;
    const seen = p.verifiedBurn || 0;
    verified += seen;
    matched += Math.min(seen, credited);
    if (seen + 1 >= credited * 0.95) coinsMatched += 1;
  }
  return {
    listed,
    verified,
    matched,
    pct: listed > 0 ? Math.min(1, Math.max(0, matched / listed)) : null,
    coins,
    coinsMatched,
  };
}

export function coverageMeter(
  projects: Pick<Project, "tier" | "launchWallet">[],
  burns: Record<string, BurnCache>,
  opts?: {
    ledger?: LedgerHit[];
    webhookAt?: number | null;
    now?: number;
    mintIndex?: { exhausted?: boolean; txChecked?: number } | null;
  },
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
  const unlabeled = unlabeledLedger(opts?.ledger);
  return {
    paidWallets: paid.size,
    paidIndexed,
    paidExhausted,
    paidPending: Math.max(0, paid.size - paidExhausted),
    lastBurnAt: latestLedgerAt(opts?.ledger),
    webhookAt,
    coverageLive: Boolean(webhookAt && now - webhookAt < WEBHOOK_LIVE_MS),
    mintExhausted: Boolean(opts?.mintIndex?.exhausted),
    mintTxChecked: opts?.mintIndex?.txChecked || 0,
    ...unlabeled,
  };
}
