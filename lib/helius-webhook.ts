import { coinFromMemos, type AttrCoin } from "./burn-attr";
import { ansemBurnInHeliusTx, type HeliusTx } from "./helius";
import { secretEquals } from "./http";
import { flattenInstructions, memoTextsFromTx } from "./memo";
import { ANSEM_MINT, type BurnVia } from "./types";

export type WebhookTx = HeliusTx & {
  feePayer?: string;
  timestamp?: number;
};

export type WebhookHit = {
  signature: string;
  wallet: string;
  amount: number;
  at: number;
  mint?: string;
  labeled?: boolean;
  via?: BurnVia;
};

export function webhookKey() {
  if (process.env.HELIUS_WEBHOOK_SECRET?.trim()) return process.env.HELIUS_WEBHOOK_SECRET.trim();
  if (process.env.VERCEL) return "";
  return "dev-webhook";
}

export function webhookAuthorized(req: Request) {
  const key = webhookKey();
  if (!key) return false;
  const header = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (header.startsWith(prefix) && secretEquals(header.slice(prefix.length), key)) return true;
  if (header && secretEquals(header, key)) return true;
  const custom = req.headers.get("x-webhook-secret") || "";
  if (custom && secretEquals(custom, key)) return true;
  const query = new URL(req.url).searchParams.get("secret") || "";
  return Boolean(query) && secretEquals(query, key);
}

export function heliusWebhookTransactions(body: unknown): WebhookTx[] {
  if (Array.isArray(body)) return body.filter((row) => row && typeof row === "object") as WebhookTx[];
  if (!body || typeof body !== "object") return [];
  const rec = body as { transactions?: unknown; body?: unknown };
  if (Array.isArray(rec.transactions)) return rec.transactions.filter((row) => row && typeof row === "object") as WebhookTx[];
  if (Array.isArray(rec.body)) return rec.body.filter((row) => row && typeof row === "object") as WebhookTx[];
  return [];
}

export function burnWalletFromTx(tx: WebhookTx, mint = ANSEM_MINT) {
  for (const transfer of tx.tokenTransfers || []) {
    if (transfer.mint && transfer.mint !== mint) continue;
    if (transfer.fromUserAccount) return transfer.fromUserAccount;
  }
  return tx.feePayer || null;
}

export function webhookHitTime(tx: WebhookTx, now = Date.now()) {
  const raw = Number(tx.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return now;
  return raw < 1e12 ? raw * 1000 : raw;
}

export function trackedMintFromTx(tx: WebhookTx, tracked: Set<string>, skip = ANSEM_MINT) {
  for (const transfer of tx.tokenTransfers || []) {
    if (transfer.mint && transfer.mint !== skip && tracked.has(transfer.mint)) return transfer.mint;
  }
  const texts = [tx.description || "", ...memoTextsFromTx(tx)];
  for (const text of texts) {
    if (!text) continue;
    for (const mint of tracked) {
      if (mint !== skip && text.includes(mint)) return mint;
    }
  }
  for (const ix of flattenInstructions(tx)) {
    for (const account of ix.accounts || []) {
      if (account !== skip && tracked.has(account)) return account;
    }
  }
  for (const ad of tx.accountData || []) {
    if (ad.account && ad.account !== skip && tracked.has(ad.account)) return ad.account;
  }
  return null;
}

export function ansemBurnsFromWebhook(
  txs: WebhookTx[],
  mint = ANSEM_MINT,
  now = Date.now(),
  tracked?: Set<string>,
  coins?: AttrCoin[],
): WebhookHit[] {
  const hits: WebhookHit[] = [];
  const seen = new Set<string>();
  for (const tx of txs) {
    const signature = tx.signature;
    if (!signature || seen.has(signature)) continue;
    const amount = ansemBurnInHeliusTx(tx, mint);
    if (!(amount > 0)) continue;
    const wallet = burnWalletFromTx(tx, mint);
    if (!wallet) continue;
    seen.add(signature);
    const trackedMint = tracked?.size ? trackedMintFromTx(tx, tracked, mint) : null;
    const memoCoin = !trackedMint && coins?.length ? coinFromMemos(memoTextsFromTx(tx), coins) : null;
    const coinMint = trackedMint || memoCoin?.mint;
    const via: BurnVia | undefined = trackedMint ? "mint" : memoCoin ? "memo" : undefined;
    hits.push({
      signature,
      wallet,
      amount,
      at: webhookHitTime(tx, now),
      ...(coinMint ? { mint: coinMint, via } : {}),
    });
  }
  return hits;
}
