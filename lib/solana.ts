import { bundleFromWindow } from "./bundle";
import { burnIndexMode, heliusApiKey, heliusPageBudget, indexHeliusBurns } from "./helius";
import { radarFromRugcheck } from "./radar";
import { rpcPostAny } from "./rpc";
import { ANSEM_DECIMALS, ANSEM_MINT, BURN_MAX_PAGES, BURN_MAX_PAGES_PAID, BURN_PAGE_SIZE } from "./types";

export { concentrationFromHolderPcts } from "./radar";

export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

type RpcRow<T> = { id?: number; result?: T; error?: { message?: string } };

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const json = (await rpcPostAny({ jsonrpc: "2.0", id: 1, method, params })) as RpcRow<T>;
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result as T;
}

async function rpcBatch<T>(calls: { method: string; params: unknown[] }[]): Promise<(T | null)[]> {
  if (calls.length === 0) return [];
  const json = (await rpcPostAny(
    calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params })),
  )) as RpcRow<T>[];
  if (!Array.isArray(json)) throw new Error("RPC batch failed");
  return [...json]
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .map((row) => (row.error ? null : (row.result as T)));
}

type Sig = { signature: string };
type ParsedIx = {
  programId?: string;
  program?: string;
  accounts?: AccountKey[];
  parsed?: {
    type?: string;
    info?: {
      mint?: string;
      mintAuthority?: string;
      tokenAmount?: { uiAmount?: number };
      amount?: string;
    };
  };
};
type AccountKey = string | { pubkey?: string };
export type ParsedTx = {
  slot?: number;
  transaction?: {
    message?: {
      accountKeys?: AccountKey[];
      instructions?: ParsedIx[];
    };
  };
  meta?: { innerInstructions?: { instructions: ParsedIx[] }[] };
};

function paidRpc() {
  const rpcUrl = process.env.SOLANA_RPC?.trim() || "";
  return Boolean(rpcUrl) && !rpcUrl.includes("api.mainnet-beta.solana.com");
}

function pageBudget() {
  return paidRpc() ? BURN_MAX_PAGES_PAID : BURN_MAX_PAGES;
}

function scanDeadlineMs() {
  return paidRpc() ? 40_000 : 18_000;
}

function allInstructions(tx: ParsedTx | null | undefined): ParsedIx[] {
  if (!tx) return [];
  return [
    ...(tx.transaction?.message?.instructions || []),
    ...(tx.meta?.innerInstructions || []).flatMap((i) => i.instructions),
  ];
}

export function burnsInTx(tx: ParsedTx | null | undefined) {
  if (!tx) return 0;
  let total = 0;
  for (const ix of allInstructions(tx)) {
    const parsed = ix?.parsed;
    if (!parsed) continue;
    if ((parsed.type === "burn" || parsed.type === "burnChecked") && parsed.info?.mint === ANSEM_MINT) {
      const raw =
        parsed.info.tokenAmount?.uiAmount ?? Number(parsed.info.amount) / 10 ** ANSEM_DECIMALS;
      total += raw || 0;
    }
  }
  return total;
}

function pubkeyOf(key: AccountKey | undefined) {
  if (!key) return null;
  return typeof key === "string" ? key : key.pubkey || null;
}

export function extractMintCreatorFromTx(tx: ParsedTx | null | undefined, mint: string) {
  if (!tx) return null;
  for (const ix of allInstructions(tx)) {
    if (ix.programId === PUMP_PROGRAM) {
      const user = pubkeyOf(ix.accounts?.[7]);
      if (user) return user;
    }
    const parsed = ix.parsed;
    if (
      parsed &&
      (parsed.type === "initializeMint" || parsed.type === "initializeMint2") &&
      parsed.info?.mint === mint &&
      parsed.info.mintAuthority
    ) {
      return parsed.info.mintAuthority;
    }
  }
  return pubkeyOf(tx.transaction?.message?.accountKeys?.[0]);
}

function txChunkSize() {
  return paidRpc() ? 10 : 1;
}

export function pumpIxCount(tx: ParsedTx | null | undefined) {
  if (!tx) return 0;
  return allInstructions(tx).filter((ix) => ix.programId === PUMP_PROGRAM).length;
}

export type BurnHit = { signature: string; amount: number };

async function sumBurns(sigs: Sig[], deadline: number) {
  let total = 0;
  let burnedTx = 0;
  const events: BurnHit[] = [];
  const size = txChunkSize();
  for (let i = 0; i < sigs.length; i += size) {
    if (Date.now() > deadline) break;
    const chunk = sigs.slice(i, i + size);
    const txs = await rpcBatch<ParsedTx>(
      chunk.map((s) => ({
        method: "getTransaction",
        params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      })),
    );
    for (let t = 0; t < txs.length; t += 1) {
      const amount = burnsInTx(txs[t]);
      if (amount > 0) {
        total += amount;
        burnedTx += 1;
        const signature = chunk[t]?.signature;
        if (signature) events.push({ signature, amount });
      }
    }
  }
  return { total, burnedTx, checked: sigs.length, events };
}

async function fetchHeliusBurns(
  wallet: string,
  opts?: {
    cursor?: string | null;
    headSig?: string | null;
    continueOlder?: boolean;
    indexedBy?: "helius" | "rpc" | null;
    reindex?: boolean;
    paceMs?: number;
    deadlineMs?: number;
  },
) {
  const reindex =
    Boolean(opts?.reindex) ||
    Boolean(opts?.indexedBy && opts.indexedBy !== "helius") ||
    Boolean(opts && !opts.indexedBy && (opts.cursor || opts.headSig));
  // Unset indexedBy with a cursor/headSig is a pre-Helius RPC window — start a native BURN index.
  const mode = burnIndexMode({ ...opts, reindex });
  return indexHeliusBurns(wallet, {
    mode,
    cursor: reindex ? null : opts?.cursor ?? null,
    headSig: reindex ? null : opts?.headSig ?? null,
    maxPages: heliusPageBudget(mode),
    deadline: Date.now() + (opts?.deadlineMs ?? scanDeadlineMs()),
    reindex,
    paceMs: opts?.paceMs,
  });
}

export async function fetchOnchainBurns(
  wallet: string,
  opts?: {
    cursor?: string | null;
    headSig?: string | null;
    continueOlder?: boolean;
    indexedBy?: "helius" | "rpc" | null;
    reindex?: boolean;
    paceMs?: number;
    deadlineMs?: number;
  },
) {
  const indexed = await fetchHeliusBurns(wallet, opts).catch(() => null);
  if (indexed) return indexed;
  // Same Helius key backs RPC. If the indexer is rate-limited, walking
  // signatures on that key usually 429s too — leave the wallet for next cron.
  if (heliusApiKey()) {
    return {
      verifiedBurn: 0,
      txChecked: 0,
      txBurned: 0,
      cursor: opts?.cursor ?? null,
      exhausted: false,
      headSig: opts?.headSig ?? null,
      events: [],
    };
  }
  const budget = pageBudget();
  const deadline = Date.now() + scanDeadlineMs();
  let pages = 0;
  let total = 0;
  let checked = 0;
  let burnedTx = 0;
  const events: BurnHit[] = [];
  let headSig = opts?.headSig ?? null;
  let cursor = opts?.cursor ?? null;
  let exhausted = false;

  let before: string | undefined;
  for (; pages < budget && Date.now() < deadline; pages += 1) {
    const sigs = await rpc<Sig[]>("getSignaturesForAddress", [
      wallet,
      { limit: BURN_PAGE_SIZE, ...(before ? { before } : {}) },
    ]);
    if (!sigs || sigs.length === 0) {
      exhausted = true;
      break;
    }
    if (!headSig || !opts?.headSig) headSig = sigs[0]?.signature ?? headSig;

    const fresh: Sig[] = [];
    let hitKnown = false;
    for (const sig of sigs) {
      if (opts?.headSig && sig.signature === opts.headSig) {
        hitKnown = true;
        break;
      }
      fresh.push(sig);
    }
    const summed = await sumBurns(fresh, deadline);
    total += summed.total;
    checked += summed.checked;
    burnedTx += summed.burnedTx;
    events.push(...summed.events);

    if (!opts?.cursor) cursor = sigs[sigs.length - 1]?.signature ?? cursor;
    if (hitKnown) break;
    if (sigs.length < BURN_PAGE_SIZE) {
      exhausted = true;
      break;
    }
    before = sigs[sigs.length - 1]?.signature;
  }

  if (opts?.continueOlder && !exhausted && cursor && pages < budget && Date.now() < deadline) {
    before = cursor;
    for (; pages < budget && Date.now() < deadline; pages += 1) {
      const sigs: Sig[] = (await rpc<Sig[]>("getSignaturesForAddress", [
        wallet,
        { limit: BURN_PAGE_SIZE, before },
      ])) || [];
      if (!sigs || sigs.length === 0) {
        exhausted = true;
        break;
      }
      const summed = await sumBurns(sigs, deadline);
      total += summed.total;
      checked += summed.checked;
      burnedTx += summed.burnedTx;
      events.push(...summed.events);
      cursor = sigs[sigs.length - 1]?.signature ?? cursor;
      if (sigs.length < BURN_PAGE_SIZE) {
        exhausted = true;
        break;
      }
      before = cursor || undefined;
    }
  }

  return { verifiedBurn: total, txChecked: checked, txBurned: burnedTx, cursor, exhausted, headSig, events, indexedBy: "rpc" as const };
}

export function holdersFromLargestAccounts(
  accounts: { address?: string; uiAmount?: number | null }[],
  total: number,
) {
  if (!(total > 0)) return [];
  return accounts
    .slice(0, 10)
    .filter((a): a is { address: string; uiAmount?: number | null } => Boolean(a.address) && (a.uiAmount || 0) > 0)
    .map((a) => ({
      address: a.address,
      owner: null as string | null,
      pct: ((a.uiAmount || 0) / total) * 100,
      insider: false,
    }));
}

async function fetchHolderConcentrationRpc(mint: string) {
  const [largest, supply] = await Promise.all([
    rpc<{ value: { address?: string; uiAmount?: number | null; amount: string }[] }>("getTokenLargestAccounts", [mint]),
    rpc<{ value: { uiAmount?: number | null } }>("getTokenSupply", [mint]),
  ]);
  const total = supply.value.uiAmount || 0;
  if (!total) return null;
  const accounts = largest.value || [];
  const top10 = accounts.slice(0, 10).reduce((sum, a) => sum + (a.uiAmount || 0), 0);
  return { top10Pct: top10 / total, holders: holdersFromLargestAccounts(accounts, total) };
}

async function fetchRugcheckReport(mint: string) {
  const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report`, {
    headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

export type HolderRadar = {
  top10Pct: number;
  insiderPct: number | null;
  sniper: boolean;
  clustered: boolean;
  holders: { address: string; owner?: string | null; pct: number; insider: boolean }[];
};

function radarOrNull(raw: unknown): HolderRadar | null {
  const parsed = radarFromRugcheck(raw as { topHolders?: { pct?: number; insider?: boolean }[] });
  if (parsed.top10Pct == null) return null;
  return {
    top10Pct: parsed.top10Pct,
    insiderPct: parsed.insiderPct,
    sniper: parsed.sniper,
    clustered: parsed.clustered,
    holders: parsed.holders,
  };
}

async function fetchHolderRadarRugcheck(mint: string) {
  const json = await fetchRugcheckReport(mint);
  return radarOrNull(json);
}

export async function fetchHolderRadar(mint: string): Promise<HolderRadar | null> {
  if (!paidRpc()) {
    const indexed = await fetchHolderRadarRugcheck(mint).catch(() => null);
    if (indexed) return indexed;
  }
  try {
    const rpcRadar = await fetchHolderConcentrationRpc(mint);
    if (rpcRadar == null) return null;
    const extra = await fetchHolderRadarRugcheck(mint).catch(() => null);
    return {
      top10Pct: extra?.top10Pct ?? rpcRadar.top10Pct,
      insiderPct: extra?.insiderPct ?? null,
      sniper: extra?.sniper ?? false,
      clustered: extra?.clustered ?? false,
      holders: extra?.holders.length ? extra.holders : rpcRadar.holders,
    };
  } catch (err) {
    if (paidRpc()) {
      const indexed = await fetchHolderRadarRugcheck(mint).catch(() => null);
      if (indexed) return indexed;
    }
    throw err;
  }
}

export async function fetchHolderConcentration(mint: string) {
  const radar = await fetchHolderRadar(mint);
  return radar?.top10Pct ?? null;
}

/** Oldest create-tx plus nearby same-slot pump buys. */
export async function fetchMintCreateWindow(mint: string) {
  const limit = 1000;
  const maxPages = paidRpc() ? 15 : 3;
  let before: string | undefined;
  let last: Sig[] = [];
  let reachedEnd = false;

  for (let page = 0; page < maxPages; page += 1) {
    const sigs = await rpc<Sig[]>("getSignaturesForAddress", [
      mint,
      { limit, ...(before ? { before } : {}) },
    ]);
    if (!sigs?.length) {
      reachedEnd = true;
      break;
    }
    last = sigs;
    if (sigs.length < limit) {
      reachedEnd = true;
      break;
    }
    before = sigs[sigs.length - 1]?.signature;
  }

  if (!reachedEnd || !last.length) return null;
  const window = last.slice(-12);
  const txs = await rpcBatch<ParsedTx>(
    window.map((s) => ({
      method: "getTransaction",
      params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
    })),
  );
  const oldest = window[window.length - 1];
  const createTx = txs[txs.length - 1];
  const creator = extractMintCreatorFromTx(createTx, mint);
  const createSlot = createTx?.slot ?? 0;
  const rows = txs.map((tx, i) => ({
    slot: tx?.slot || 0,
    feePayer: pubkeyOf(tx?.transaction?.message?.accountKeys?.[0]),
    pumpIxs: pumpIxCount(tx),
    signature: window[i]?.signature || "",
  }));
  return {
    creator,
    signature: oldest?.signature || null,
    slot: createSlot || null,
    bundle: bundleFromWindow(createSlot, rows),
  };
}

export async function fetchMintCreatePayer(mint: string) {
  const window = await fetchMintCreateWindow(mint);
  return window?.creator ?? null;
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type TokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: { uiAmount?: number | null };
        };
      };
    };
  };
};

export function mapTokenAccounts(
  rows: {
    account?: {
      data?: {
        parsed?: {
          info?: {
            mint?: string;
            tokenAmount?: { uiAmount?: number | null };
          };
        };
      };
    };
  }[],
) {
  const out: { mint: string; amount: number }[] = [];
  for (const row of rows) {
    const mint = row.account?.data?.parsed?.info?.mint;
    if (!mint) continue;
    const raw = row.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
    const amount = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    out.push({ mint, amount });
  }
  return out;
}

async function tokenAccounts(wallet: string, programId: string) {
  const json = await rpc<{ value?: TokenAccount[] }>("getTokenAccountsByOwner", [
    wallet,
    { programId },
    { encoding: "jsonParsed" },
  ]);
  return mapTokenAccounts(json.value || []);
}

export async function fetchWalletMintBalances(wallet: string) {
  const spl = await tokenAccounts(wallet, TOKEN_PROGRAM);
  const t22 = await tokenAccounts(wallet, TOKEN_2022).catch(() => [] as { mint: string; amount: number }[]);
  const merged = new Map<string, number>();
  for (const row of [...spl, ...t22]) {
    merged.set(row.mint, (merged.get(row.mint) || 0) + row.amount);
  }
  return [...merged.entries()].map(([mint, amount]) => ({ mint, amount }));
}

