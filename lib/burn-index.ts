import type { AttrCoin } from "./burn-attr";
import { LEDGER_MAX } from "./burn-ledger";
import { burnIndexMode, collectHeliusTxs } from "./helius";
import { ansemBurnsFromWebhook } from "./helius-webhook";
import { ANSEM_MINT, type LedgerHit, type MintBurnIndex } from "./types";

export const BURN_HITS_MAX = 2_000;
export const MINT_HEAD_STALE_MS = 10 * 60 * 1000;

export const EMPTY_MINT_INDEX: MintBurnIndex = {
  cursor: null,
  headSig: null,
  exhausted: false,
  scannedAt: 0,
  txChecked: 0,
  txBurned: 0,
};

export function seedBurnHits(
  hits: Record<string, LedgerHit> | undefined,
  ledger: LedgerHit[] | undefined,
): Record<string, LedgerHit> {
  if (hits && Object.keys(hits).length) return hits;
  if (!ledger?.length) return {};
  return Object.fromEntries(ledger.filter((h) => h.signature).map((h) => [h.signature, h]));
}

export function parseBurnHits(raw: unknown): Record<string, LedgerHit> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, LedgerHit> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const hit = parseLedgerHit(value);
    if (!hit) continue;
    out[hit.signature || key] = hit;
  }
  return pruneBurnHits(out);
}

export function parseMintBurnIndex(raw: unknown): MintBurnIndex {
  if (!raw || typeof raw !== "object") return { ...EMPTY_MINT_INDEX };
  const row = raw as Record<string, unknown>;
  return {
    cursor: typeof row.cursor === "string" ? row.cursor : null,
    headSig: typeof row.headSig === "string" ? row.headSig : null,
    exhausted: Boolean(row.exhausted),
    scannedAt: Number(row.scannedAt) || 0,
    txChecked: Number(row.txChecked) || 0,
    txBurned: Number(row.txBurned) || 0,
  };
}

function parseLedgerHit(raw: unknown): LedgerHit | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const signature = typeof row.signature === "string" ? row.signature : "";
  const wallet = typeof row.wallet === "string" ? row.wallet : "";
  const amount = Number(row.amount);
  const at = Number(row.at);
  if (!signature || !wallet || !(amount > 0) || !Number.isFinite(at)) return null;
  const candidates = Array.isArray(row.candidates)
    ? row.candidates.filter((m): m is string => typeof m === "string" && m.length > 0)
    : undefined;
  return {
    signature,
    wallet,
    amount,
    at,
    mint: typeof row.mint === "string" ? row.mint : undefined,
    labeled: typeof row.labeled === "boolean" ? row.labeled : undefined,
    via: row.via === "wallet" || row.via === "mint" || row.via === "memo" || row.via === "amount" ? row.via : undefined,
    candidates: candidates?.length ? candidates : undefined,
  };
}

export function mergeHit(prev: LedgerHit, next: LedgerHit): LedgerHit {
  const labeled = prev.labeled === false && next.labeled ? true : next.labeled ?? prev.labeled;
  return {
    ...prev,
    ...next,
    amount: prev.amount || next.amount,
    at: Math.max(prev.at || 0, next.at || 0),
    mint: next.mint || prev.mint,
    labeled,
    via: next.via || prev.via,
    candidates: labeled ? undefined : next.candidates ?? prev.candidates,
  };
}

export function pruneBurnHits(hits: Record<string, LedgerHit>, max = BURN_HITS_MAX) {
  const list = Object.values(hits);
  if (list.length <= max) return hits;
  const unlabeled = list.filter((h) => h.labeled === false).sort((a, b) => b.at - a.at);
  const labeled = list.filter((h) => h.labeled !== false).sort((a, b) => b.at - a.at);
  const keep = [...unlabeled, ...labeled].slice(0, max);
  return Object.fromEntries(keep.map((hit) => [hit.signature, hit]));
}

export function upsertBurnHits(
  prev: Record<string, LedgerHit> | undefined,
  hits: LedgerHit[],
  max = BURN_HITS_MAX,
) {
  const next = { ...(prev || {}) };
  const fresh: LedgerHit[] = [];
  for (const hit of hits) {
    if (!hit.signature || !(hit.amount > 0)) continue;
    const existing = next[hit.signature];
    if (existing) {
      next[hit.signature] = mergeHit(existing, hit);
      continue;
    }
    next[hit.signature] = hit;
    fresh.push(hit);
  }
  return { hits: pruneBurnHits(next, max), fresh };
}

export function ledgerFromHits(hits: Record<string, LedgerHit> | undefined, max = LEDGER_MAX) {
  const list = Object.values(hits || {});
  return list
    .sort((a, b) => {
      const aOpen = a.labeled === false ? 0 : 1;
      const bOpen = b.labeled === false ? 0 : 1;
      return aOpen - bOpen || b.at - a.at || a.signature.localeCompare(b.signature);
    })
    .slice(0, max);
}

export function hitsLedger(hits: Record<string, LedgerHit> | undefined, fallback: LedgerHit[] | undefined) {
  const list = Object.values(hits || {});
  return list.length ? list : fallback || [];
}

export function mintIndexMode(index: MintBurnIndex | undefined, now = Date.now(), live = false) {
  if (!index?.headSig) return burnIndexMode({});
  if (!index.exhausted) return burnIndexMode({ cursor: index.cursor, continueOlder: true });
  if (live) return null;
  if (now - (index.scannedAt || 0) < MINT_HEAD_STALE_MS) return null;
  return burnIndexMode({ headSig: index.headSig });
}

export async function pullMintBurns(opts: {
  index: MintBurnIndex | undefined;
  tracked: Set<string>;
  coins: AttrCoin[];
  now?: number;
  maxPages?: number;
  deadline?: number;
  live?: boolean;
}) {
  const now = opts.now ?? Date.now();
  const prev = opts.index || EMPTY_MINT_INDEX;
  const mode = mintIndexMode(prev, now, opts.live);
  if (!mode) return null;
  const collected = await collectHeliusTxs(ANSEM_MINT, {
    mode,
    cursor: prev.cursor,
    headSig: prev.headSig,
    maxPages: opts.maxPages ?? (mode === "head" ? 2 : 3),
    deadline: opts.deadline ?? now + 20_000,
    type: "BURN",
  });
  if (!collected) return null;
  const hits = ansemBurnsFromWebhook(collected.txs, ANSEM_MINT, now, opts.tracked, opts.coins);
  return {
    index: {
      cursor: mode === "head" ? prev.cursor : collected.cursor,
      headSig: collected.headSig || prev.headSig,
      exhausted: mode === "head" ? true : collected.exhausted,
      scannedAt: now,
      txChecked: (prev.txChecked || 0) + collected.txs.length,
      txBurned: (prev.txBurned || 0) + hits.length,
    } satisfies MintBurnIndex,
    hits,
  };
}
