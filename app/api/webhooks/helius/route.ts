import { NextResponse } from "next/server";
import { alertContext, tapeForAlerts } from "@/lib/alert-filter";
import { invalidateBoard } from "@/lib/board";
import { ingestWebhookHits, namedLaunchForWallet } from "@/lib/burn-ledger";
import { mapTier, type AnsemCoin } from "@/lib/ansem";
import { ansemBurnsFromWebhook, heliusWebhookTransactions, webhookAuthorized } from "@/lib/helius-webhook";
import { notifyTape } from "@/lib/notify";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_BYTES = 1_500_000;

export async function POST(req: Request) {
  if (!webhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const text = await req.text();
  if (text.length > MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  let body: unknown = [];
  try {
    body = text ? JSON.parse(text) : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const hits = ansemBurnsFromWebhook(heliusWebhookTransactions(body));
  if (!hits.length) return NextResponse.json({ ok: true, hits: 0 });

  try {
    const result = await withStore((store) => {
      const coins = (store.coinSnapshot.coins || []) as AnsemCoin[];
      const known = new Set<string>();
      for (const coin of coins) {
        if (coin.creatorWallet) known.add(coin.creatorWallet);
      }
      for (const row of store.community) {
        if (row.launchWallet) known.add(row.launchWallet);
      }
      for (const wallet of Object.keys(store.burns || {})) known.add(wallet);
      const ingested = ingestWebhookHits({
        hits,
        burns: store.burns,
        ledger: store.burnLedger || [],
        tape: store.tape || [],
        knownWallets: known,
        namedFor: (wallet) => namedLaunchForWallet(wallet, coins, store.community),
      });
      store.burns = ingested.burns;
      store.burnLedger = ingested.ledger;
      store.tape = ingested.tape;
      store.webhookAt = Date.now();
      const alerts = tapeForAlerts(
        ingested.events,
        alertContext({
          watches: store.watches,
          coins: coins.map((c) => ({ mint: c.mint, tier: mapTier(c.tier) })),
        }),
      );
      return { hits: ingested.fresh.length, alerts: alerts.length, events: ingested.events, alertsTape: alerts };
    });
    invalidateBoard();
    if (result.alertsTape.length) notifyTape(result.alertsTape).catch(() => undefined);
    return NextResponse.json({ ok: true, hits: result.hits, tape: result.events.length, alerts: result.alerts });
  } catch (err) {
    console.error("helius webhook failed", err);
    return NextResponse.json({ error: "Couldn't ingest burns." }, { status: 502 });
  }
}
