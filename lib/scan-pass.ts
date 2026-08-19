import { activeBoost, creditedBurn, fetchAnsemBoosts, fetchAnsemCoinsFeed, fetchAnsemMarket, fetchAnsemProjectBurns, imageUrlFrom, mapTier, mergeProjectBurns, type AnsemBoost, type AnsemCoin } from "./ansem";
import { alertContext, tapeForAlerts } from "./alert-filter";
import { ingestWalletScan, ingestWebhookHits, namedLaunchForMint, namedLaunchForWallet, tapeFromFresh } from "./burn-ledger";
import { EMPTY_MINT_INDEX, hitsLedger, ledgerFromHits, pruneBurnHits, pullMintBurns, seedBurnHits, upsertBurnHits } from "./burn-index";
import { attributeStrangerBurns } from "./burn-attr";
import { fetchDexBatch, overlayDex } from "./dex";
import { enrichBudget, nextEnrichMints } from "./enrich";
import { issueFlags } from "./flag-ledger";
import { outcomeHints, resolveDueFlags } from "./flag-resolve";
import { WEBHOOK_LIVE_MS } from "./coverage";
import { heliusApiKey } from "./helius";
import { isPaidTier } from "./paid-radar";
import { buildIndexDay, previousIndexDay, pushIndexDay } from "./index-day";
import { notifyTape } from "./notify";
import { provenanceCacheForEnrich, resolveProvenance } from "./provenance";
import { airdropMcapUsd, computeScore, officialScore, publicBurn, ranksFromOrder } from "./score";
import { dexRefreshBudget, heliusPaceMs, nextScanTargets, pendingFirstPass, scanBudget, SCAN_PASS_MS } from "./scan";
import { fetchHolderRadar, fetchOnchainBurns } from "./solana";
import { readStore, withStore } from "./store";
import {
  detectBoostEvents,
  detectDayRankMoves,
  detectLaunches,
  detectMigrations,
  detectSerialFlags,
  pushHistory,
  pushTape,
  snapshotStatuses,
} from "./tape";
import { ANSEM_MINT, DEX_HOT_MS, type BurnCache, type DexCache, type Dossier, type TapeEvent } from "./types";

function coinName(c: Pick<AnsemCoin, "name" | "ticker" | "mint">) {
  return { mint: c.mint, name: c.name, ticker: c.ticker, status: null as string | null };
}

export async function runScanPass(opts?: { maxMs?: number }) {
  const store = await readStore();
  if ((store.scanLockUntil || 0) > Date.now()) {
    return {
      scanned: 0,
      errors: 0,
      wallets: [] as string[],
      pending: 0,
      unfinished: Object.values(store.burns).filter((b) => !b.exhausted).length,
      mode: "lock" as const,
      dex: 0,
      lastWallet: store.scanCursor.lastWallet,
      tape: 0,
      at: Date.now(),
    };
  }
  let coins: AnsemCoin[] = [];
  let liveList = false;
  try {
    const feed = await fetchAnsemCoinsFeed();
    coins = feed.coins;
    liveList = feed.live && feed.coins.length > 0;
  } catch {
    coins = [];
  }
  if (!coins.length) coins = (store.coinSnapshot.coins || []) as AnsemCoin[];
  const visible = coins.filter((c) => c.mint && c.mint !== ANSEM_MINT);
  const now = Date.now();
  const targets = [
    ...visible
      .filter((c) => c.creatorWallet)
      .map((c) => ({
        wallet: c.creatorWallet as string,
        mint: c.mint,
        tier: mapTier(c.tier),
        addedAt: c.createdAt ? Date.parse(c.createdAt) : now,
      })),
    ...store.community
      .filter((p) => !p.hidden && p.launchWallet)
      .map((p) => ({
        wallet: p.launchWallet as string,
        mint: p.mint,
        tier: p.tier,
        addedAt: p.addedAt,
      })),
    ...Object.values(store.burns).map((b) => ({
      wallet: b.wallet,
      mint: "",
      tier: "Unranked",
      addedAt: 0,
    })),
  ];

  const pending = pendingFirstPass(targets, store.burns);
  const unfinished = Object.values(store.burns).filter((b) => !b.exhausted).length;
  const catchup = pending > 0 || unfinished > 0;
  const burst = pending > 0 && Boolean(heliusApiKey());
  const batch = nextScanTargets(
    targets,
    store.burns,
    scanBudget(catchup ? Math.max(pending, unfinished, 1) : 0),
    now,
    Boolean(heliusApiKey()),
    burst,
  );
  const burns: Record<string, BurnCache> = { ...store.burns };
  let burnHits = seedBurnHits(store.burnHits, store.burnLedger);
  let ledger = ledgerFromHits(burnHits);
  let mintBurnIndex = store.mintBurnIndex || EMPTY_MINT_INDEX;
  let scanned = 0;
  let errors = 0;
  let lastWallet = store.scanCursor.lastWallet;
  let freshTape: TapeEvent[] = [];
  const stopAt = Date.now() + (opts?.maxMs ?? SCAN_PASS_MS);
  const paceMs = heliusPaceMs(catchup ? 1 : 0);

  const knownStart = new Set<string>();
  for (const coin of visible) {
    if (coin.creatorWallet) knownStart.add(coin.creatorWallet);
  }
  for (const row of store.community) {
    if (row.launchWallet) knownStart.add(row.launchWallet);
  }
  for (const wallet of Object.keys(burns)) knownStart.add(wallet);

  if (heliusApiKey() && Date.now() < stopAt - 12_000) {
    try {
      const mint = await pullMintBurns({
        index: mintBurnIndex,
        tracked: new Set(visible.map((c) => c.mint)),
        coins: visible,
        now,
        maxPages: burst ? 1 : catchup ? 2 : 3,
        deadline: Date.now() + (burst ? 8_000 : catchup ? 20_000 : 30_000),
        live: Boolean(store.webhookAt && now - store.webhookAt < WEBHOOK_LIVE_MS),
      });
      if (mint) {
        mintBurnIndex = mint.index;
        const ingested = ingestWebhookHits({
          hits: mint.hits,
          burns,
          ledger,
          tape: freshTape,
          knownWallets: knownStart,
          namedFor: (wallet) => namedLaunchForWallet(wallet, visible, store.community),
          namedForMint: (mintAddr) => namedLaunchForMint(mintAddr, visible, store.community),
          seenSignatures: Object.keys(burnHits),
        });
        Object.assign(burns, ingested.burns);
        burnHits = upsertBurnHits(burnHits, ingested.fresh).hits;
        ledger = ledgerFromHits(burnHits);
        freshTape = ingested.tape;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/api-key=[^&\s]+/gi, "api-key=[redacted]") : "mint index failed";
      console.error("mint burn index failed", msg);
    }
  }

  for (const t of batch) {
    if (Date.now() >= stopAt) break;
    const cached = burns[t.wallet];
    try {
      const firstTouch = !cached || cached.indexedBy !== "helius";
      const reindexPaid = isPaidTier(t.tier) && Boolean(cached?.exhausted);
      const scan = await fetchOnchainBurns(t.wallet, {
        cursor: cached?.cursor,
        headSig: cached?.headSig,
        continueOlder: Boolean(cached && !cached.exhausted) && !reindexPaid,
        indexedBy: cached?.indexedBy ?? null,
        reindex: reindexPaid,
        paceMs,
        maxPages: burst && firstTouch ? 2 : undefined,
        deadlineMs: !burst && isPaidTier(t.tier) && !cached?.exhausted ? 18_000 : catchup ? (firstTouch ? 3_000 : 8_000) : undefined,
      });
      if (!scan.indexedBy && scan.txChecked === 0) {
        errors += 1;
        continue;
      }
      const named =
        namedLaunchForWallet(t.wallet, visible, store.community) ||
        coinName({ mint: t.mint || t.wallet, name: t.mint || t.wallet, ticker: "" });
      const ingested = ingestWalletScan({
        wallet: t.wallet,
        scan,
        burns,
        ledger,
        tape: freshTape,
        named,
        seenSignatures: Object.keys(burnHits),
      });
      Object.assign(burns, ingested.burns);
      burnHits = upsertBurnHits(burnHits, ingested.fresh).hits;
      ledger = ledgerFromHits(burnHits);
      freshTape = ingested.tape;
      scanned += 1;
      lastWallet = t.wallet;
      if (burst && scanned % 25 === 0) {
        await withStore((s) => {
          s.burns = { ...s.burns, ...burns };
          s.burnHits = burnHits;
          s.burnLedger = ledger;
          s.mintBurnIndex = mintBurnIndex;
        });
      }
    } catch (err) {
      errors += 1;
      const msg = err instanceof Error ? err.message.replace(/api-key=[^&\s]+/gi, "api-key=[redacted]") : "scan failed";
      console.error("burn wallet failed", t.wallet, msg);
    }
  }

  const namedCoins = visible.map((c) => ({
    mint: c.mint,
    name: c.name,
    ticker: c.ticker,
    status: c.status || null,
    slug: c.slug,
  }));
  freshTape.push(...detectLaunches(store.seenMints, namedCoins, now));
  freshTape.push(
    ...detectSerialFlags(
      store.seenMints,
      visible.map((c) => ({
        mint: c.mint,
        name: c.name,
        ticker: c.ticker,
        slug: c.slug,
        wallet: c.creatorWallet || null,
      })),
      now,
    ),
  );
  freshTape.push(...detectMigrations(store.mintStatus, namedCoins, now));

  const staleDex = burst || catchup
    ? []
    : visible
        .map((c) => c.mint)
        .filter((mint) => {
          const hit = store.dex[mint];
          return !hit || now - hit.at > DEX_HOT_MS;
        })
        .slice(0, dexRefreshBudget());
  let dexFresh: Record<string, DexCache> = {};
  if (staleDex.length) {
    try {
      const batchDex = await fetchDexBatch(staleDex);
      const at = Date.now();
      dexFresh = Object.fromEntries(Object.entries(batchDex).map(([mint, live]) => [mint, { at, live }]));
    } catch {
      dexFresh = {};
    }
  }

  const [boosts, market, liveBurns] = await Promise.all([
    fetchAnsemBoosts().catch(() => ({} as Record<string, AnsemBoost>)),
    fetchAnsemMarket().catch(() => null),
    fetchAnsemProjectBurns().catch(() => ({}) as Record<string, { amount: number; burners: number }>),
  ]);
  const projectBurns = mergeProjectBurns(liveBurns, store.projectBurns);
  const boostTape = detectBoostEvents(store.boostSeen || {}, namedCoins, boosts, now);
  freshTape.push(...boostTape.events);
  const ansemPrice = market?.priceUsd || 0;
  const dex = { ...store.dex, ...dexFresh };
  const scored = visible.map((c) => {
    const boost = activeBoost(boosts[c.slug], now);
    const listedAirdropMcap = airdropMcapUsd(c.priceUsd, c.airdropTotal);
    const listed = {
      priceUsd: c.priceUsd ?? null,
      marketCap: c.marketCapUsd ?? null,
      fdv: c.marketCapUsd ?? null,
      airdropMcap: listedAirdropMcap,
      volume24h: c.volume24hUsd ?? null,
      change24h: c.change24hPct ?? null,
      liquidity: null,
      dexUrl: null,
      symbol: c.ticker || "",
      name: c.name || "",
    };
    const live = overlayDex(listed, dex[c.mint]?.live);
    live.airdropMcap = airdropMcapUsd(live.priceUsd, c.airdropTotal) ?? live.airdropMcap;
    const burn = c.creatorWallet ? burns[c.creatorWallet] : undefined;
    const listedBurn = creditedBurn(c.mint, projectBurns).amount;
    return {
      mint: c.mint,
      score: computeScore({
        live,
        verifiedBurn: burn?.verifiedBurn ?? null,
        burnAmount: 0,
        burnPriceRef: ansemPrice,
        boostPoints: boost?.amount || 0,
        listedBurn,
      }),
      official: officialScore({
        listedMarketCap: c.marketCapUsd ?? null,
      }),
      listedBurn,
      walletBurn: burn?.verifiedBurn ?? null,
    };
  });
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  freshTape.push(
    ...detectDayRankMoves(
      previousIndexDay(store.indexDays, now),
      ranked.map((r, i) => {
        const coin = visible.find((c) => c.mint === r.mint);
        return {
          mint: r.mint,
          rank: i + 1,
          name: coin?.name || r.mint,
          ticker: coin?.ticker,
          slug: coin?.slug,
        };
      }),
      now,
    ),
  );
  const indexMcap = coins.find((c) => c.mint === ANSEM_MINT)?.marketCapUsd || 0;
  const officialOrder = [
    ...scored,
    ...(indexMcap > 0 ? [{ mint: "__z500_index__", score: 0, official: indexMcap, listedBurn: null, walletBurn: null }] : []),
  ].sort((a, b) => b.official - a.official);

  const hotMints = ranked.map((r) => r.mint);
  const skipSide = burst || catchup;
  const paidMints = visible.filter((c) => isPaidTier(mapTier(c.tier))).map((c) => c.mint);
  const provSeen = new Set<string>();
  const provCache = provenanceCacheForEnrich(store.provenance);
  const provMints = [
    ...nextEnrichMints(paidMints, provCache, 30 * 60 * 1000, paidMints.length, now),
    ...(skipSide ? [] : nextEnrichMints(hotMints, provCache, 30 * 60 * 1000, enrichBudget("provenance"), now)),
  ].filter((mint) => {
    if (provSeen.has(mint)) return false;
    provSeen.add(mint);
    return true;
  });
  const holdMints = skipSide ? [] : nextEnrichMints(hotMints, store.holders, 15 * 60 * 1000, enrichBudget("holders"), now);
  const provenance: typeof store.provenance = { ...store.provenance };
  const holders: typeof store.holders = { ...store.holders };
  const dossiers: Record<string, Dossier> = { ...store.dossiers };

  for (const mint of provMints) {
    const coin = visible.find((c) => c.mint === mint);
    try {
      const resolved = await resolveProvenance(mint, coin?.creatorWallet || null);
      provenance[mint] = { creator: resolved.creator, status: resolved.status, at: resolved.at };
      const prev = dossiers[mint];
      dossiers[mint] = {
        at: resolved.at,
        holders: prev?.holders || [],
        creator: resolved.creator,
        onchainCreator: resolved.sources.onchain,
        pumpCreator: resolved.sources.pump,
        createSig: resolved.createSig,
        createSlot: resolved.createSlot,
        sameBlockBuys: resolved.bundle.sameBlockBuys,
        sameBlockWallets: resolved.bundle.sameBlockWallets,
        sameBlockBuyers: resolved.bundle.sameBlockBuyers,
        sniper: resolved.bundle.sniper || prev?.sniper || false,
      };
      if (resolved.bundle.sniper && holders[mint]) {
        holders[mint] = { ...holders[mint], sniper: true };
      }
    } catch {
      /* skip */
    }
  }
  for (const mint of holdMints) {
    try {
      const radar = await fetchHolderRadar(mint);
      if (radar) {
        const sniper = radar.sniper || Boolean(dossiers[mint]?.sniper);
        holders[mint] = {
          top10Pct: radar.top10Pct,
          at: Date.now(),
          insiderPct: radar.insiderPct,
          sniper,
          clustered: radar.clustered,
          holders: radar.holders,
        };
        const prev = dossiers[mint];
        dossiers[mint] = {
          at: Date.now(),
          holders: radar.holders,
          creator: prev?.creator ?? provenance[mint]?.creator ?? null,
          onchainCreator: prev?.onchainCreator ?? null,
          pumpCreator: prev?.pumpCreator ?? null,
          createSig: prev?.createSig ?? null,
          createSlot: prev?.createSlot ?? null,
          sameBlockBuys: prev?.sameBlockBuys ?? 0,
          sameBlockWallets: prev?.sameBlockWallets ?? 0,
          sameBlockBuyers: prev?.sameBlockBuyers,
          sniper,
        };
      }
    } catch {
      /* skip */
    }
  }

  const finishedAt = Date.now();
  const rankSnap = {
    at: finishedAt,
    ranks: ranksFromOrder(ranked.map((r) => r.mint)),
    official: ranksFromOrder(officialOrder.map((r) => r.mint)),
  };
  await withStore((s) => {
    s.burns = { ...s.burns, ...burns };
    s.dex = { ...s.dex, ...dexFresh };
    s.provenance = { ...s.provenance, ...provenance };
    s.holders = { ...s.holders, ...holders };
    s.dossiers = { ...s.dossiers, ...dossiers };
    s.indexDays = pushIndexDay(
      s.indexDays || [],
      buildIndexDay(
        ranked.map((r) => {
          const coin = visible.find((c) => c.mint === r.mint);
          const official = officialOrder.findIndex((o) => o.mint === r.mint) + 1;
          return {
            mint: r.mint,
            name: coin?.name || r.mint,
            ticker: coin?.ticker,
            score: r.score,
            officialRank: official || null,
            airdropMcap: airdropMcapUsd(coin?.priceUsd, coin?.airdropTotal),
            burned: publicBurn({
              verifiedBurn: r.walletBurn,
              burnAmount: 0,
              listedBurn: r.listedBurn,
            }),
            imageUrl: imageUrlFrom(coin?.imageUrl),
            marketCap: dex[r.mint]?.live.marketCap ?? coin?.marketCapUsd ?? null,
            change24h: dex[r.mint]?.live.change24h ?? coin?.change24hPct ?? null,
            tier: coin ? mapTier(coin.tier) : undefined,
            status: coin?.status ?? null,
          };
        }),
        finishedAt,
      ),
    );
    s.boostSeen = boostTape.next;
    s.scanCursor = {
      at: finishedAt,
      scanned: (s.scanCursor.scanned || 0) + scanned,
      lastWallet,
      errors: (s.scanCursor.errors || 0) + errors,
    };
    s.rankSnapshot = rankSnap;
    s.rankHistory = pushHistory(s.rankHistory || [], rankSnap);
    const known = new Set<string>();
    for (const coin of visible) {
      if (coin.creatorWallet) known.add(coin.creatorWallet);
    }
    for (const row of s.community) {
      if (row.launchWallet) known.add(row.launchWallet);
    }
    for (const wallet of Object.keys(s.burns || {})) known.add(wallet);
    const attr = attributeStrangerBurns({
      ledger: hitsLedger(burnHits, ledger),
      attributed: s.attributedBurns || {},
      coins: visible,
      burns: s.burns,
      knownWallets: known,
      projectBurns,
    });
    if (attr.assigned.length) {
      freshTape.push(
        ...attr.assigned.flatMap((hit) => {
          const named = hit.mint ? namedLaunchForMint(hit.mint, visible, s.community) : null;
          return tapeFromFresh(
            [hit],
            named || { mint: hit.mint || hit.wallet, name: hit.mint || "Unknown" },
            finishedAt,
          );
        }),
      );
    }
    burnHits = pruneBurnHits(Object.fromEntries(attr.ledger.filter((h) => h.signature).map((h) => [h.signature, h])));
    s.attributedBurns = attr.attributed;
    if (Object.keys(projectBurns).length) s.projectBurns = projectBurns;
    s.flagsIssued = resolveDueFlags(
      issueFlags(s.flagsIssued, [...freshTape, ...(s.tape || [])], finishedAt),
      outcomeHints(visible, dex),
      finishedAt,
    );
    s.tape = pushTape(s.tape || [], freshTape);
    s.burnHits = burnHits;
    s.burnLedger = ledgerFromHits(burnHits);
    s.mintBurnIndex = mintBurnIndex;
    s.seenMints = namedCoins.map((c) => c.mint);
    s.mintStatus = snapshotStatuses(namedCoins);
    if (liveList && coins.length) s.coinSnapshot = { at: finishedAt, coins };
    else if (coins.length && !(s.coinSnapshot.coins || []).length) s.coinSnapshot = { at: finishedAt, coins };
  });

  if (freshTape.length) {
    const alerts = tapeForAlerts(
      freshTape,
      alertContext({
        watches: store.watches,
        coins: visible.map((c) => ({ mint: c.mint, tier: mapTier(c.tier) })),
      }),
    );
    if (alerts.length) notifyTape(alerts).catch(() => undefined);
  }

  return {
    scanned,
    errors,
    wallets: batch.slice(0, scanned).map((t) => t.wallet),
    pending: Math.max(0, pending - scanned),
    unfinished,
    mode: burst ? "burst" : catchup ? "catchup" : "cruise",
    dex: Object.keys(dexFresh).length,
    lastWallet,
    tape: freshTape.length,
    mintTxChecked: mintBurnIndex.txChecked,
    at: finishedAt,
  };
}
