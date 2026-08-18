import {
  burnIndexMode,
  headScanApply,
  heliusApiKey,
  heliusPageBudget,
  heliusRpcUrl,
  indexHeliusBurns,
  isTransferCursor,
  type BurnIndexMode,
  type HeliusIndexResult,
} from "./helius";
import { ANSEM_DECIMALS, ANSEM_MINT } from "./types";

export const TRANSFER_PAGE = 100;

export type TransferRow = {
  signature?: string;
  type?: string;
  mint?: string;
  amount?: string | number;
  uiAmount?: string | number;
  decimals?: number;
  fromUserAccount?: string | null;
  toUserAccount?: string | null;
};

type TransferPage = {
  data: TransferRow[];
  paginationToken: string | null;
};

type RpcError = { code?: number; message?: string };

let transferApi: "unknown" | "ok" | "missing" = "unknown";

export function resetTransferApiState() {
  transferApi = "unknown";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function transferAmount(row: TransferRow) {
  const ui = Number(row.uiAmount);
  if (ui > 0) return ui;
  const raw = Number(row.amount);
  if (!(raw > 0)) return 0;
  return raw / 10 ** (row.decimals ?? ANSEM_DECIMALS);
}

export function isAnsemBurnTransfer(row: TransferRow, mint = ANSEM_MINT) {
  if (row.mint && row.mint !== mint) return false;
  const kind = (row.type || "").toLowerCase();
  if (kind === "mint" || kind === "wrap" || kind === "unwrap") return false;
  if (kind === "burn") return true;
  if (kind) return false;
  return row.toUserAccount == null && Boolean(row.fromUserAccount);
}

export function ansemBurnInTransfer(row: TransferRow, mint = ANSEM_MINT) {
  if (!isAnsemBurnTransfer(row, mint)) return 0;
  return transferAmount(row);
}

export function sumTransferBurns(rows: TransferRow[], mint = ANSEM_MINT) {
  let verifiedBurn = 0;
  let txBurned = 0;
  const events: { signature: string; amount: number }[] = [];
  for (const row of rows) {
    const amount = ansemBurnInTransfer(row, mint);
    if (!(amount > 0)) continue;
    verifiedBurn += amount;
    txBurned += 1;
    if (row.signature) events.push({ signature: row.signature, amount });
  }
  return { verifiedBurn, txBurned, txChecked: rows.length, events };
}

function methodUnavailable(err?: RpcError | null) {
  const code = err?.code ?? 0;
  const msg = (err?.message || "").toLowerCase();
  if (code === -32601 || code === -32600) return true;
  return /not found|not available|developer plan|upgrade|forbidden|unauthorized|method .*exist/i.test(msg);
}

async function fetchTransferPage(
  rpcUrl: string,
  wallet: string,
  config: { paginationToken?: string; limit?: number },
): Promise<{ page: TransferPage | null; unavailable?: boolean; status: number }> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "crosscheck/1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "cc-transfers",
        method: "getTransfersByAddress",
        params: [
          wallet,
          {
            mint: ANSEM_MINT,
            direction: "out",
            limit: config.limit ?? TRANSFER_PAGE,
            sortOrder: "desc",
            ...(config.paginationToken ? { paginationToken: config.paginationToken } : {}),
          },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(2_000);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      return { page: null, unavailable: true, status: res.status };
    }
    if (!res.ok) return { page: null, status: res.status };
    const body = (await res.json()) as { result?: TransferPage; error?: RpcError };
    if (body.error) {
      return { page: null, unavailable: methodUnavailable(body.error), status: res.status };
    }
    const data = Array.isArray(body.result?.data) ? body.result.data : [];
    const paginationToken = body.result?.paginationToken ?? null;
    return { page: { data, paginationToken }, status: res.status };
  }
  return { page: null, status: 429 };
}

function takeUntilSig(batch: TransferRow[], until?: string | null) {
  if (!until) return { rows: batch, hitUntil: false };
  const rows: TransferRow[] = [];
  for (const row of batch) {
    if (row.signature === until) return { rows, hitUntil: true };
    rows.push(row);
  }
  return { rows, hitUntil: false };
}

export async function probeTransferApi(wallet: string) {
  const rpcUrl = heliusRpcUrl();
  if (!rpcUrl) return { ok: false, unavailable: true, status: 0, transfers: 0, burns: 0, error: "missing-rpc" };
  const fetched = await fetchTransferPage(rpcUrl, wallet, { limit: 10 });
  if (fetched.unavailable) return { ok: false, unavailable: true, status: fetched.status, transfers: 0, burns: 0 };
  if (!fetched.page) return { ok: false, unavailable: false, status: fetched.status, transfers: 0, burns: 0 };
  const summed = sumTransferBurns(fetched.page.data);
  return {
    ok: true,
    unavailable: false,
    status: fetched.status,
    transfers: fetched.page.data.length,
    burns: summed.txBurned,
    verifiedBurn: summed.verifiedBurn,
    pagination: Boolean(fetched.page.paginationToken),
  };
}

export async function indexTransferBurns(
  wallet: string,
  opts: {
    mode: BurnIndexMode;
    cursor?: string | null;
    headSig?: string | null;
    maxPages?: number;
    deadline?: number;
    reindex?: boolean;
    paceMs?: number;
  },
): Promise<HeliusIndexResult | { unavailable: true } | null> {
  const rpcUrl = heliusRpcUrl();
  if (!rpcUrl) return null;
  const resumeOlder = opts.mode === "older" && isTransferCursor(opts.cursor);
  const replace = Boolean(opts.reindex || opts.mode === "fresh" || (opts.mode === "older" && !resumeOlder));
  const mode: BurnIndexMode = replace && opts.mode === "older" ? "fresh" : opts.mode;
  const maxPages = opts.maxPages ?? heliusPageBudget(mode);
  const deadline = opts.deadline ?? Date.now() + 20_000;
  const until = mode === "head" ? opts.headSig || undefined : undefined;
  let paginationToken = resumeOlder ? opts.cursor || undefined : undefined;
  let headSig = opts.headSig || null;
  let cursor = resumeOlder ? opts.cursor || null : null;
  let exhausted = mode === "head";
  let hitUntil = mode !== "head";
  let reachedEnd = false;
  const collected: TransferRow[] = [];

  for (let page = 0; page < maxPages && Date.now() < deadline; page += 1) {
    const fetched = await fetchTransferPage(rpcUrl, wallet, { paginationToken });
    if (fetched.unavailable) return { unavailable: true };
    if (!fetched.page) {
      if (!collected.length && page === 0) return null;
      break;
    }
    const batch = fetched.page.data;
    if (!batch.length) {
      reachedEnd = true;
      if (mode !== "head") exhausted = true;
      cursor = null;
      break;
    }
    const sliced = takeUntilSig(batch, until);
    if (sliced.hitUntil) hitUntil = true;
    if (mode !== "older" && !headSig && sliced.rows[0]?.signature) headSig = sliced.rows[0].signature;
    if (mode === "head" && sliced.rows[0]?.signature) headSig = sliced.rows[0].signature;
    collected.push(...sliced.rows);
    if (mode !== "head") cursor = fetched.page.paginationToken;
    const pageEnded = !fetched.page.paginationToken || batch.length < TRANSFER_PAGE;
    if (sliced.hitUntil || pageEnded) {
      if (pageEnded) reachedEnd = true;
      if (mode !== "head") exhausted = true;
      if (!fetched.page.paginationToken) cursor = null;
      break;
    }
    paginationToken = fetched.page.paginationToken || undefined;
    if (!paginationToken) {
      reachedEnd = true;
      exhausted = mode !== "head";
      break;
    }
    await sleep(opts.paceMs ?? 50);
  }

  if (mode === "head") {
    const apply = headScanApply(hitUntil, reachedEnd, collected.length);
    if (apply === "skip") {
      return {
        verifiedBurn: 0,
        txChecked: collected.length,
        txBurned: 0,
        cursor: opts.cursor || null,
        exhausted: true,
        headSig: opts.headSig || null,
        events: [],
        replace: false,
        indexedBy: "helius",
      };
    }
    const summed = sumTransferBurns(collected);
    return {
      verifiedBurn: summed.verifiedBurn,
      txChecked: summed.txChecked,
      txBurned: summed.txBurned,
      cursor: opts.cursor || null,
      exhausted: true,
      headSig,
      events: summed.events,
      replace: apply === "replace" || replace,
      indexedBy: "helius",
    };
  }

  const summed = sumTransferBurns(collected);
  return {
    verifiedBurn: summed.verifiedBurn,
    txChecked: summed.txChecked,
    txBurned: summed.txBurned,
    cursor,
    exhausted,
    headSig,
    events: summed.events,
    replace,
    indexedBy: "helius",
  };
}

export async function indexWalletBurns(
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
  const forceEnhanced = process.env.HELIUS_INDEX === "enhanced";
  const forceTransfers = process.env.HELIUS_INDEX === "transfers";
  if (!forceEnhanced && transferApi !== "missing") {
    const scan = await indexTransferBurns(wallet, opts);
    if (scan && "unavailable" in scan) transferApi = "missing";
    else if (scan) {
      transferApi = "ok";
      return scan;
    } else if (forceTransfers) return null;
  }
  if (forceTransfers) return null;
  if (!heliusApiKey(undefined, opts.key ?? undefined)) return null;
  return indexHeliusBurns(wallet, opts);
}

export { burnIndexMode };
