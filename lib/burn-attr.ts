import { creditedBurn } from "./ansem";
import { memoTextsFromTx } from "./memo";
import {
  isIndexMint,
  type AttributedBurn,
  type BurnCache,
  type BurnVia,
  type LedgerHit,
} from "./types";
import type { HeliusTx } from "./helius";

export type { AttributedBurn, BurnVia };

export type AttrCoin = {
  mint: string;
  name?: string;
  ticker?: string;
  slug?: string;
  launchWallet?: string | null;
  listedBurn?: number | null;
};

export const ATTRIBUTED_MAX = 2_500;
const AMOUNT_EPS = 1;

export function extraBurnForMint(rows: Record<string, AttributedBurn> | undefined, mint: string) {
  let total = 0;
  for (const row of Object.values(rows || {})) {
    if (row.mint === mint) total += row.amount || 0;
  }
  return total;
}

export function extraBurnTotal(rows: Record<string, AttributedBurn> | undefined) {
  let total = 0;
  for (const row of Object.values(rows || {})) total += row.amount || 0;
  return total;
}

export function independentBurn(walletBurn: number | null | undefined, extra: number) {
  if (walletBurn == null && !(extra > 0)) return null;
  return (walletBurn || 0) + extra;
}

export function pruneAttributed(rows: Record<string, AttributedBurn>, max = ATTRIBUTED_MAX) {
  const list = Object.values(rows);
  if (list.length <= max) return rows;
  return Object.fromEntries(
    [...list]
      .sort((a, b) => b.at - a.at)
      .slice(0, max)
      .map((row) => [row.signature, row]),
  );
}

function wordHit(hay: string, needle: string) {
  if (!needle || needle.length < 3) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(hay);
}

export function coinFromText(text: string, coins: AttrCoin[]) {
  const trimmed = text.trim();
  if (!trimmed || !coins.length) return null;
  try {
    const json = JSON.parse(trimmed) as { mint?: string; slug?: string; ticker?: string };
    const byMint = coins.find((c) => json.mint && c.mint === json.mint);
    if (byMint) return byMint;
    const bySlug = coins.filter((c) => json.slug && c.slug && c.slug.toLowerCase() === String(json.slug).toLowerCase());
    if (bySlug.length === 1) return bySlug[0]!;
  } catch {
    /* not json */
  }
  const mintHits = coins.filter((c) => c.mint && trimmed.includes(c.mint));
  if (mintHits.length === 1) return mintHits[0]!;
  const slugHits = coins.filter((c) => wordHit(trimmed, c.slug || ""));
  if (slugHits.length === 1) return slugHits[0]!;
  const tickerHits = coins.filter((c) => wordHit(trimmed, c.ticker || ""));
  if (tickerHits.length === 1) return tickerHits[0]!;
  return null;
}

export function coinFromMemos(texts: string[], coins: AttrCoin[]) {
  for (const text of texts) {
    const hit = coinFromText(text, coins);
    if (hit) return hit;
  }
  return null;
}

export function coinFromTx(tx: HeliusTx, coins: AttrCoin[]) {
  return coinFromMemos(memoTextsFromTx(tx), coins);
}

export function viaLabel(via?: BurnVia | null) {
  if (via === "wallet") return "launch wallet";
  if (via === "mint") return "tx named the coin";
  if (via === "memo") return "memo";
  if (via === "amount") return "matched ansem gap";
  return "";
}

type GapCoin = { mint: string; gap: number };

function walletBurnFor(coin: AttrCoin, burns: Record<string, Pick<BurnCache, "verifiedBurn">>) {
  if (!coin.launchWallet) return 0;
  return burns[coin.launchWallet]?.verifiedBurn || 0;
}

export function remainingGaps(
  coins: AttrCoin[],
  burns: Record<string, Pick<BurnCache, "verifiedBurn">>,
  attributed: Record<string, AttributedBurn>,
  projectBurns?: Record<string, { amount: number; burners: number }>,
) {
  const extra: Record<string, number> = {};
  for (const row of Object.values(attributed)) extra[row.mint] = (extra[row.mint] || 0) + row.amount;
  const gaps: GapCoin[] = [];
  for (const coin of coins) {
    if (!coin.mint || isIndexMint(coin.mint)) continue;
    const listed = projectBurns ? creditedBurn(coin.mint, projectBurns).amount : coin.listedBurn;
    if (!(listed != null && listed > 0)) continue;
    const gap = listed - walletBurnFor(coin, burns) - (extra[coin.mint] || 0);
    if (gap > AMOUNT_EPS) gaps.push({ mint: coin.mint, gap });
  }
  return gaps;
}

/** Assign when exactly one credited coin is missing this amount, or only one coin still has a gap. */
export function matchAmountToCoin(amount: number, gaps: GapCoin[]) {
  if (!(amount > 0) || !gaps.length) return null;
  const exact = gaps.filter((g) => Math.abs(g.gap - amount) <= AMOUNT_EPS);
  if (exact.length === 1) return exact[0]!.mint;
  if (exact.length > 1) return null;
  if (gaps.length === 1 && amount <= gaps[0]!.gap + AMOUNT_EPS) return gaps[0]!.mint;
  return null;
}

/** Exact remaining gaps that share this amount. Empty unless the match is ambiguous. */
export function candidateMints(amount: number, gaps: GapCoin[]) {
  if (!(amount > 0) || gaps.length < 2) return [];
  const exact = gaps.filter((g) => Math.abs(g.gap - amount) <= AMOUNT_EPS).map((g) => g.mint);
  return exact.length > 1 ? exact : [];
}

function putAttributed(rows: Record<string, AttributedBurn>, hit: LedgerHit, mint: string, via: BurnVia) {
  if (!hit.signature || rows[hit.signature]) return rows;
  rows[hit.signature] = {
    signature: hit.signature,
    mint,
    amount: hit.amount,
    via,
    wallet: hit.wallet,
    at: hit.at,
  };
  return rows;
}

export function attributeStrangerBurns(opts: {
  ledger: LedgerHit[];
  attributed: Record<string, AttributedBurn>;
  coins: AttrCoin[];
  burns: Record<string, Pick<BurnCache, "verifiedBurn">>;
  knownWallets: Set<string>;
  projectBurns?: Record<string, { amount: number; burners: number }>;
}) {
  let attributed = { ...opts.attributed };
  const assigned: LedgerHit[] = [];
  const ledger = opts.ledger.map((hit) => {
    if (opts.knownWallets.has(hit.wallet)) return hit;
    if (!hit.mint) return hit;
    const via: BurnVia = hit.via === "memo" || hit.via === "amount" ? hit.via : "mint";
    attributed = putAttributed(attributed, hit, hit.mint, via);
    return { ...hit, labeled: true, via };
  });

  const unlabeled = ledger
    .map((hit, index) => ({ hit, index }))
    .filter(({ hit }) => hit.labeled === false && !hit.mint && !attributed[hit.signature] && !opts.knownWallets.has(hit.wallet))
    .sort((a, b) => b.hit.amount - a.hit.amount);

  if (unlabeled.length && opts.projectBurns && Object.keys(opts.projectBurns).length) {
    for (const row of unlabeled) {
      const gaps = remainingGaps(opts.coins, opts.burns, attributed, opts.projectBurns);
      const fromCandidates = (row.hit.candidates || []).filter((mint) =>
        gaps.some((g) => g.mint === mint && row.hit.amount <= g.gap + AMOUNT_EPS),
      );
      const mint =
        fromCandidates.length === 1 ? fromCandidates[0]! : matchAmountToCoin(row.hit.amount, gaps);
      if (mint) {
        const next: LedgerHit = { ...row.hit, mint, labeled: true, via: "amount", candidates: undefined };
        ledger[row.index] = next;
        attributed = putAttributed(attributed, next, mint, "amount");
        assigned.push(next);
        continue;
      }
      const cands = candidateMints(row.hit.amount, gaps);
      if (cands.length) {
        ledger[row.index] = { ...row.hit, candidates: cands, labeled: false };
      }
    }
  }

  return { ledger, attributed: pruneAttributed(attributed), assigned };
}
