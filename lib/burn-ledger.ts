import { applyBurnScan } from "./burns";
import { burnDeltaEvent, burnEvents, pushTape } from "./tape";
import type { BurnCache, CommunityProject, LedgerHit, TapeEvent } from "./types";

export type { LedgerHit } from "./types";

export const LEDGER_MAX = 300;
export const LEDGER_PER_WALLET = 40;

export type BurnScan = {
  verifiedBurn: number;
  txChecked: number;
  txBurned: number;
  cursor: string | null;
  exhausted: boolean;
  headSig: string | null;
  events: { signature: string; amount: number }[];
  replace?: boolean;
  indexedBy?: "helius" | "rpc";
};

export type NamedLaunch = {
  mint: string;
  name: string;
  ticker?: string;
  slug?: string;
  status?: string | null;
};

export function mergeLedger(ledger: LedgerHit[], hits: LedgerHit[], max = LEDGER_MAX) {
  if (!hits.length) return { ledger, fresh: [] as LedgerHit[] };
  const seen = new Set(ledger.map((h) => h.signature));
  const fresh: LedgerHit[] = [];
  for (const hit of hits) {
    if (!hit.signature || !(hit.amount > 0) || seen.has(hit.signature)) continue;
    seen.add(hit.signature);
    fresh.push(hit);
  }
  if (!fresh.length) return { ledger, fresh };
  return { ledger: [...fresh, ...ledger].slice(0, max), fresh };
}

export function ledgerForWallet(ledger: LedgerHit[] | undefined, wallet: string | null | undefined, max = LEDGER_PER_WALLET) {
  if (!wallet || !ledger?.length) return [];
  return ledger.filter((h) => h.wallet === wallet).slice(0, max);
}

export function ledgerForMint(
  ledger: LedgerHit[] | undefined,
  mint: string | null | undefined,
  wallet?: string | null,
  max = LEDGER_PER_WALLET,
) {
  if (!ledger?.length) return [];
  return ledger.filter((h) => (mint && h.mint === mint) || (wallet && h.wallet === wallet)).slice(0, max);
}

export function latestLedgerAt(ledger: LedgerHit[] | undefined) {
  if (!ledger?.length) return null;
  let latest = 0;
  for (const hit of ledger) {
    if (hit.at > latest) latest = hit.at;
  }
  return latest || null;
}

export function namedLaunchForWallet(
  wallet: string,
  coins: {
    mint?: string;
    name?: string;
    ticker?: string;
    slug?: string;
    creatorWallet?: string | null;
    status?: string | null;
  }[],
  community: Pick<CommunityProject, "mint" | "name" | "launchWallet">[] = [],
): NamedLaunch | null {
  const coin = coins.find((c) => c.creatorWallet === wallet);
  if (coin?.mint) {
    return {
      mint: coin.mint,
      name: coin.name || coin.mint,
      ticker: coin.ticker || undefined,
      slug: coin.slug || undefined,
      status: coin.status ?? null,
    };
  }
  const row = community.find((p) => p.launchWallet === wallet);
  if (!row) return null;
  return { mint: row.mint, name: row.name, status: null };
}

export function applyWalletScan(prev: BurnCache | undefined, scan: BurnScan, fresh: LedgerHit[], wallet = prev?.wallet || fresh[0]?.wallet || "") {
  const useFresh = Boolean(!scan.replace && scan.events.length);
  const adjusted = {
    ...scan,
    verifiedBurn: useFresh ? fresh.reduce((sum, hit) => sum + hit.amount, 0) : scan.verifiedBurn,
    txBurned: useFresh ? fresh.length : scan.txBurned,
  };
  return applyBurnScan(wallet, prev, adjusted);
}

export function applyWebhookHit(prev: BurnCache | undefined, hit: LedgerHit, now = Date.now()): BurnCache {
  const headSig = prev?.headSig || hit.signature;
  return {
    wallet: hit.wallet,
    verifiedBurn: (prev?.verifiedBurn || 0) + hit.amount,
    txChecked: (prev?.txChecked || 0) + 1,
    txBurned: (prev?.txBurned || 0) + 1,
    scannedAt: now,
    cursor: prev?.cursor ?? null,
    exhausted: Boolean(prev?.exhausted),
    headSig,
    indexedBy: "helius",
  };
}

export function tapeFromFresh(fresh: LedgerHit[], named: NamedLaunch, now = Date.now()): TapeEvent[] {
  if (!fresh.length) return [];
  return burnEvents(
    fresh.map((h) => ({ signature: h.signature, amount: h.amount })),
    named,
    now,
  );
}

export function ingestWalletScan(opts: {
  wallet: string;
  scan: BurnScan;
  burns: Record<string, BurnCache>;
  ledger: LedgerHit[];
  tape: TapeEvent[];
  named: NamedLaunch | null;
  now?: number;
}) {
  const now = opts.now ?? Date.now();
  const prev = opts.burns[opts.wallet];
  const hits: LedgerHit[] = (opts.scan.events || []).map((event) => ({
    signature: event.signature,
    wallet: opts.wallet,
    amount: event.amount,
    at: now,
    mint: opts.named?.mint,
  }));
  const merged = mergeLedger(opts.ledger, hits);
  const cache = applyWalletScan(prev, opts.scan, merged.fresh, opts.wallet);
  const named = opts.named || { mint: opts.wallet, name: "Unknown" };
  let events: TapeEvent[] = [];
  if (merged.fresh.length) events = tapeFromFresh(merged.fresh, named, now);
  else if (!opts.scan.events.length) {
    const delta = opts.scan.replace ? 0 : opts.scan.verifiedBurn;
    const fallback = burnDeltaEvent(delta, named, opts.wallet, now);
    if (fallback) events = [fallback];
  }
  return {
    burns: { ...opts.burns, [opts.wallet]: cache },
    ledger: merged.ledger,
    tape: events.length ? pushTape(opts.tape, events) : opts.tape,
    fresh: merged.fresh,
    events,
    cache,
  };
}

export function ingestWebhookHits(opts: {
  hits: { signature: string; wallet: string; amount: number; at: number }[];
  burns: Record<string, BurnCache>;
  ledger: LedgerHit[];
  tape: TapeEvent[];
  knownWallets: Set<string>;
  namedFor: (wallet: string) => NamedLaunch | null;
  now?: number;
}) {
  const now = opts.now ?? Date.now();
  const knownHits = opts.hits.filter((hit) => opts.knownWallets.has(hit.wallet));
  const mapped: LedgerHit[] = knownHits.map((hit) => ({
    ...hit,
    mint: opts.namedFor(hit.wallet)?.mint,
  }));
  const merged = mergeLedger(opts.ledger, mapped);
  const burns = { ...opts.burns };
  const events: TapeEvent[] = [];
  for (const hit of merged.fresh) {
    burns[hit.wallet] = applyWebhookHit(burns[hit.wallet], hit, now);
    const named = opts.namedFor(hit.wallet) || { mint: hit.mint || hit.wallet, name: "Unknown" };
    events.push(...tapeFromFresh([hit], named, hit.at || now));
  }
  return {
    burns,
    ledger: merged.ledger,
    tape: events.length ? pushTape(opts.tape, events) : opts.tape,
    fresh: merged.fresh,
    events,
  };
}
