import { NextResponse } from "next/server";
import { alertContext, tapeForAlerts } from "@/lib/alert-filter";
import { fetchAnsemProjectBurns, mapTier, mergeProjectBurns, type AnsemCoin } from "@/lib/ansem";
import { invalidateBoard } from "@/lib/board";
import { attributeStrangerBurns } from "@/lib/burn-attr";
import { ingestWebhookHits, namedLaunchForMint, namedLaunchForWallet, tapeFromFresh } from "@/lib/burn-ledger";
import { hitsLedger, ledgerFromHits, pruneBurnHits, seedBurnHits, upsertBurnHits } from "@/lib/burn-index";
import { ansemBurnsFromWebhook, heliusWebhookTransactions, webhookAuthorized } from "@/lib/helius-webhook";
import { notifyTape } from "@/lib/notify";
import { pushTape } from "@/lib/tape";
import { withStore } from "@/lib/store";
import { ANSEM_MINT } from "@/lib/types";

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
  const txs = heliusWebhookTransactions(body);
  if (!ansemBurnsFromWebhook(txs).length) return NextResponse.json({ ok: true, hits: 0 });

  const liveBurns = await fetchAnsemProjectBurns().catch(() => ({} as Record<string, { amount: number; burners: number }>));

  try {
    const result = await withStore((store) => {
      const coins = (store.coinSnapshot.coins || []) as AnsemCoin[];
      const tracked = new Set(coins.map((c) => c.mint).filter(Boolean));
      const hits = ansemBurnsFromWebhook(txs, ANSEM_MINT, Date.now(), tracked, coins);
      const known = new Set<string>();
      for (const coin of coins) {
        if (coin.creatorWallet) known.add(coin.creatorWallet);
      }
      for (const row of store.community) {
        if (row.launchWallet) known.add(row.launchWallet);
      }
      for (const wallet of Object.keys(store.burns || {})) known.add(wallet);
      const burnHits = seedBurnHits(store.burnHits, store.burnLedger);
      const ingested = ingestWebhookHits({
        hits,
        burns: store.burns,
        ledger: ledgerFromHits(burnHits),
        tape: store.tape || [],
        knownWallets: known,
        namedFor: (wallet) => namedLaunchForWallet(wallet, coins, store.community),
        namedForMint: (mint) => namedLaunchForMint(mint, coins, store.community),
        seenSignatures: Object.keys(burnHits),
      });
      const projectBurns = mergeProjectBurns(liveBurns, store.projectBurns);
      const mergedHits = upsertBurnHits(burnHits, ingested.fresh).hits;
      const attr = attributeStrangerBurns({
        ledger: hitsLedger(mergedHits, ingested.ledger),
        attributed: store.attributedBurns || {},
        coins,
        burns: ingested.burns,
        knownWallets: known,
        projectBurns,
      });
      let tape = ingested.tape;
      let events = ingested.events;
      if (attr.assigned.length) {
        const extra = attr.assigned.flatMap((hit) => {
          const named = hit.mint ? namedLaunchForMint(hit.mint, coins, store.community) : null;
          return tapeFromFresh([hit], named || { mint: hit.mint || hit.wallet, name: hit.mint || "Unknown" }, hit.at);
        });
        tape = pushTape(tape, extra);
        events = [...events, ...extra];
      }
      store.burns = ingested.burns;
      store.burnHits = pruneBurnHits(Object.fromEntries(attr.ledger.filter((h) => h.signature).map((h) => [h.signature, h])));
      store.burnLedger = ledgerFromHits(store.burnHits);
      store.attributedBurns = attr.attributed;
      if (Object.keys(projectBurns).length) store.projectBurns = projectBurns;
      store.tape = tape;
      store.webhookAt = Date.now();
      const alerts = tapeForAlerts(
        events,
        alertContext({
          watches: store.watches,
          coins: coins.map((c) => ({ mint: c.mint, tier: mapTier(c.tier) })),
        }),
      );
      return { hits: ingested.fresh.length, alerts: alerts.length, events, alertsTape: alerts };
    });
    invalidateBoard();
    if (result.alertsTape.length) notifyTape(result.alertsTape).catch(() => undefined);
    return NextResponse.json({ ok: true, hits: result.hits, tape: result.events.length, alerts: result.alerts });
  } catch (err) {
    console.error("helius webhook failed", err);
    return NextResponse.json({ error: "Couldn't ingest burns." }, { status: 502 });
  }
}
