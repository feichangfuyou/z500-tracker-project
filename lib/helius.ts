import { ANSEM_DECIMALS, ANSEM_MINT } from "./types";

export const HELIUS_PAGE = 100;
export const HELIUS_PAGES_FRESH = 15;
export const HELIUS_PAGES_CONTINUE = 12;
export const HELIUS_PAGES_HEAD = 6;

export function heliusApiKey(rpcUrl = process.env.SOLANA_RPC || "", extra = process.env.HELIUS_API_KEY) {
  const fromEnv = extra?.trim();
  if (fromEnv) return fromEnv;
  try {
    const url = new URL(rpcUrl);
    return url.searchParams.get("api-key") || url.searchParams.get("apiKey");
  } catch {
    return null;
  }
}

export function heliusRpcUrl(rpcUrl = process.env.SOLANA_RPC || "", extra = process.env.HELIUS_API_KEY) {
  const trimmed = rpcUrl.trim();
  if (trimmed && /helius-rpc\.com/i.test(trimmed)) return trimmed;
  const key = heliusApiKey(rpcUrl, extra);
  if (!key) return null;
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

export function isTransferCursor(cursor?: string | null) {
  return Boolean(cursor && /^\d+:\d+:/.test(cursor));
}

export type HeliusTx = {
  signature?: string;
  type?: string;
  tokenTransfers?: {
    mint?: string;
    tokenAmount?: number | string;
    fromUserAccount?: string | null;
    toUserAccount?: string | null;
  }[];
  events?: { burn?: { amount?: number | string }[] };
  accountData?: {
    tokenBalanceChanges?: {
      mint?: string;
      rawTokenAmount?: { tokenAmount?: string; decimals?: number };
    }[];
  }[];
};

export type BurnIndexMode = "fresh" | "head" | "older";

export function burnIndexMode(opts?: {
  cursor?: string | null;
  headSig?: string | null;
  continueOlder?: boolean;
  reindex?: boolean;
}): BurnIndexMode {
  if (opts?.reindex) return "fresh";
  if (opts?.continueOlder && opts.cursor) return "older";
  if (opts?.headSig) return "head";
  if (opts?.cursor) return "older";
  return "fresh";
}

export function heliusPageBudget(mode: BurnIndexMode) {
  if (mode === "older") return HELIUS_PAGES_CONTINUE;
  if (mode === "head") return HELIUS_PAGES_HEAD;
  return HELIUS_PAGES_FRESH;
}

export function heliusHistoryUrl(
  address: string,
  key: string,
  q: { before?: string; until?: string; limit?: number } = {},
) {
  const url = new URL(`https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions`);
  url.searchParams.set("api-key", key);
  url.searchParams.set("limit", String(q.limit ?? HELIUS_PAGE));
  if (q.before) url.searchParams.set("before", q.before);
  if (q.until) url.searchParams.set("until", q.until);
  return url;
}

export function takeUntilSig(batch: HeliusTx[], until?: string | null) {
  if (!until) return { txs: batch, hitUntil: false };
  const txs: HeliusTx[] = [];
  for (const tx of batch) {
    if (tx.signature === until) return { txs, hitUntil: true };
    txs.push(tx);
  }
  return { txs, hitUntil: false };
}

export function heliusPageDone(batchLen: number, hitUntil: boolean, limit = HELIUS_PAGE) {
  return hitUntil || batchLen < limit;
}

function burnFromTransfers(tx: HeliusTx, mint: string, typedBurn: boolean) {
  let total = 0;
  for (const t of tx.tokenTransfers || []) {
    if (t.mint !== mint) continue;
    const amt = Number(t.tokenAmount) || 0;
    if (!(amt > 0)) continue;
    if (typedBurn || !t.toUserAccount) total += amt;
  }
  return total;
}

function burnFromBalanceChanges(tx: HeliusTx, mint: string) {
  let total = 0;
  for (const ad of tx.accountData || []) {
    for (const ch of ad.tokenBalanceChanges || []) {
      if (ch.mint !== mint) continue;
      const raw = Number(ch.rawTokenAmount?.tokenAmount);
      if (!(raw < 0)) continue;
      const decimals = ch.rawTokenAmount?.decimals ?? ANSEM_DECIMALS;
      total += Math.abs(raw) / 10 ** decimals;
    }
  }
  return total;
}

export function ansemBurnInHeliusTx(tx: HeliusTx, mint = ANSEM_MINT) {
  const kind = (tx.type || "").toUpperCase();
  const typedBurn = kind === "BURN";
  const fromTransfers = burnFromTransfers(tx, mint, typedBurn);
  // Prefer the Helius transfer row when present so we do not double-count the
  // matching negative balance change. UNKNOWN Token-2022 burns often have no
  // transfer row — fall back to balance changes only then.
  if (fromTransfers > 0) return fromTransfers;
  if (typedBurn || kind === "UNKNOWN") return burnFromBalanceChanges(tx, mint);
  return 0;
}

export function sumHeliusBurns(txs: HeliusTx[], mint = ANSEM_MINT) {
  let verifiedBurn = 0;
  let txBurned = 0;
  const events: { signature: string; amount: number }[] = [];
  for (const tx of txs) {
    const amount = ansemBurnInHeliusTx(tx, mint);
    if (!(amount > 0)) continue;
    verifiedBurn += amount;
    txBurned += 1;
    if (tx.signature) events.push({ signature: tx.signature, amount });
  }
  return { verifiedBurn, txBurned, txChecked: txs.length, events };
}

export type HeliusIndexResult = {
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

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchHeliusPage(url: URL) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    // Helius uses 404 when a wallet has no matching events in the window.
    if (res.status === 404) return [];
    if (res.status === 429 || res.status >= 500) {
      await sleep(2_000);
      continue;
    }
    if (!res.ok) return null;
    const batch = (await res.json()) as HeliusTx[];
    return Array.isArray(batch) ? batch : null;
  }
  return null;
}

export async function indexHeliusBurns(
  wallet: string,
  opts: {
    mode: BurnIndexMode;
    cursor?: string | null;
    headSig?: string | null;
    maxPages?: number;
    deadline?: number;
    key?: string | null;
    reindex?: boolean;
    paceMs?: number;
  },
): Promise<HeliusIndexResult | null> {
  const key = opts.key ?? heliusApiKey();
  if (!key) return null;
  const maxPages = opts.maxPages ?? heliusPageBudget(opts.mode);
  const deadline = opts.deadline ?? Date.now() + 20_000;
  const until = opts.mode === "head" ? opts.headSig || undefined : undefined;
  let before = opts.mode === "older" ? opts.cursor || undefined : undefined;
  let headSig = opts.headSig || null;
  let cursor = opts.cursor || null;
  let exhausted = opts.mode === "head";
  let joined = opts.mode !== "head";
  const collected: HeliusTx[] = [];

  for (let page = 0; page < maxPages && Date.now() < deadline; page += 1) {
    const batch = await fetchHeliusPage(heliusHistoryUrl(wallet, key, { before, until, limit: HELIUS_PAGE }));
    if (!batch) {
      if (!collected.length && page === 0) return null;
      break;
    }
    if (!batch.length) {
      if (opts.mode !== "head") exhausted = true;
      joined = true;
      break;
    }
    const sliced = takeUntilSig(batch, until);
    if (sliced.hitUntil) joined = true;
    if (opts.mode !== "older" && !headSig && sliced.txs[0]?.signature) headSig = sliced.txs[0].signature;
    if (opts.mode === "head" && sliced.txs[0]?.signature) headSig = sliced.txs[0].signature;
    collected.push(...sliced.txs);
    if (opts.mode !== "head") {
      const last = sliced.txs[sliced.txs.length - 1]?.signature || batch[batch.length - 1]?.signature;
      if (last) cursor = last;
    }
    if (heliusPageDone(batch.length, sliced.hitUntil)) {
      if (opts.mode !== "head") exhausted = true;
      joined = joined || sliced.hitUntil || batch.length < HELIUS_PAGE;
      break;
    }
    before = batch[batch.length - 1]?.signature;
    if (!before) break;
    await sleep(opts.paceMs ?? 80);
  }

  if (opts.mode === "head" && collected.length && !joined) {
    return {
      verifiedBurn: 0,
      txChecked: collected.length,
      txBurned: 0,
      cursor: opts.cursor || null,
      exhausted: true,
      headSig: opts.headSig || null,
      events: [],
      replace: Boolean(opts.reindex),
      indexedBy: "helius",
    };
  }

  const summed = sumHeliusBurns(collected);
  return {
    verifiedBurn: summed.verifiedBurn,
    txChecked: summed.txChecked,
    txBurned: summed.txBurned,
    cursor,
    exhausted,
    headSig,
    events: summed.events,
    replace: Boolean(opts.reindex),
    indexedBy: "helius",
  };
}
