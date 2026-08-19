import { cache } from "react";
import {
  fetchAnsemBoosts,
  fetchAnsemCoins,
  fetchAnsemMarket,
  fetchAnsemProjectBurns,
  creditedBurn,
  fetchAnsemStats,
  fetchDexFallbackCoins,
  fetchPumpFallbackCoins,
  mapTier,
  activeBoost,
  bannerUrlFrom,
  imageUrlFrom,
  type AnsemBoost,
  type AnsemCoin,
} from "./ansem";
import { coverageMeter, isListedFeed, uniqueVerifiedBurns } from "./coverage";
import { fetchDexBatch, overlayDex, type DexLive } from "./dex";
import { airdropMcapUsd, computeScore, officialDelta, officialScore, ranksFromOrder } from "./score";
import { readStore } from "./store";
import { ANSEM_MINT, DEX_HOT_MS, type BoardResponse, type DexCache, type Project, type RankSnapshot } from "./types";
import { projectFlags } from "./flags";
import { notifyChannels } from "./notify";
import { provenanceFromStore } from "./provenance";
import { launchCounts } from "./wallets";

type BoardPayload = Omit<BoardResponse, "sid">;

const BOARD_FRESH_MS = 8_000;
const BOARD_STALE_MS = 20_000;

type BoardMemo = {
  at: number;
  value: BoardPayload | null;
  inflight: Promise<BoardPayload> | null;
};

const g = globalThis as typeof globalThis & { __crosscheckBoard?: BoardMemo };

function listedLive(c: AnsemCoin) {
  const airdrop = airdropMcapUsd(c.priceUsd, c.airdropTotal);
  return {
    priceUsd: c.priceUsd ?? null,
    marketCap: c.marketCapUsd ?? null,
    fdv: c.marketCapUsd ?? null,
    airdropMcap: airdrop,
    volume24h: c.volume24hUsd ?? null,
    change24h: c.change24hPct ?? null,
    liquidity: null as number | null,
    dexUrl: `https://dexscreener.com/solana/${c.mint}`,
    symbol: c.ticker || "",
    name: c.name || "",
    mcapSource: "listed" as const,
  };
}

function withAirdrop(live: Project["live"], airdropTotal: number | null | undefined) {
  if (!live) return live;
  return { ...live, airdropMcap: airdropMcapUsd(live.priceUsd, airdropTotal) ?? live.airdropMcap };
}

function boostFor(slug: string | undefined, boosts: Record<string, AnsemBoost>, now: number) {
  if (!slug) return { boostPoints: 0, boostGolden: false, boostExpiresAt: null as string | null };
  const hit = activeBoost(boosts[slug], now);
  return {
    boostPoints: hit?.amount || 0,
    boostGolden: Boolean(hit?.golden),
    boostExpiresAt: hit?.expiresAt || null,
  };
}

export function applyRanks(
  projects: Project[],
  snapshot: RankSnapshot,
  listedFeed = true,
  indexMcap = 0,
): Project[] {
  const ansem = listedFeed ? projects.filter((p) => p.source === "ansem") : [];
  const official = ranksFromOrder(
    [
      ...ansem.map((p) => ({ id: p.id, name: p.name, mcap: officialScore(p) })),
      ...(indexMcap > 0 ? [{ id: "__z500_index__", name: "\0", mcap: indexMcap }] : []),
    ]
      .sort((a, b) => b.mcap - a.mcap || a.name.localeCompare(b.name))
      .map((p) => p.id),
  );
  const crosscheckAnsem = ranksFromOrder(
    [...ansem].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).map((p) => p.id),
  );
  const scored = [...projects].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const boardRank = ranksFromOrder(scored.map((p) => p.id));
  return scored.map((p) => {
    const rank = boardRank[p.id] || 0;
    const officialRank = listedFeed && p.source === "ansem" ? official[p.id] ?? null : null;
    const vsOfficial = listedFeed && p.source === "ansem" ? crosscheckAnsem[p.id] || 0 : 0;
    const prev = snapshot.ranks[p.mint];
    return {
      ...p,
      officialRank,
      officialDelta: officialDelta(officialRank, vsOfficial),
      rankDelta: prev ? prev - rank : 0,
    };
  });
}

export function snapshotRanks(projects: Project[], at = Date.now()): RankSnapshot {
  const order = [...projects].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { at, ranks: ranksFromOrder(order.map((p) => p.mint)) };
}

async function hotDex(mints: string[], cached: Record<string, DexCache>, now: number) {
  const stale = mints.filter((mint) => {
    const hit = cached[mint];
    return !hit || now - hit.at > DEX_HOT_MS;
  });
  if (!stale.length) return {} as Record<string, DexLive>;
  try {
    return await fetchDexBatch(stale.slice(0, 30));
  } catch {
    return {} as Record<string, DexLive>;
  }
}

async function assembleBoard(): Promise<BoardPayload> {
  const storeP = readStore();
  const extrasP = Promise.all([
    fetchAnsemMarket().catch(() => null),
    fetchAnsemStats().catch(() => ({
      coins: null,
      airdroppedUsd: null,
      burnedAnsem: null,
      holders: null,
    })),
    fetchAnsemBoosts().catch(() => ({} as Record<string, AnsemBoost>)),
  ]);
  let feedSource: BoardResponse["feedSource"] = "ansem";
  let coins: AnsemCoin[] = [];
  try {
    coins = await fetchAnsemCoins();
  } catch {
    coins = [];
  }
  const store = await storeP;
  if (!coins.length && store.coinSnapshot.coins.length) {
    coins = store.coinSnapshot.coins as AnsemCoin[];
    feedSource = "cache";
  }
  if (!coins.length) {
    coins = await fetchPumpFallbackCoins().catch(() => []);
    if (coins.length) feedSource = "pump";
  }
  if (!coins.length) {
    coins = await fetchDexFallbackCoins().catch(() => []);
    if (coins.length) feedSource = "dex";
  }

  const now = Date.now();
  const [market, stats, boosts] = await extrasP;
  const projectBurns = await fetchAnsemProjectBurns().catch((err) => {
    console.error("ansem project-burns", err);
    return {} as Record<string, { amount: number; burners: number }>;
  });
  if (!Object.keys(projectBurns).length) console.error("ansem project-burns empty");

  const indexMcap = coins.find((c) => c.mint === ANSEM_MINT)?.marketCapUsd || 0;
  const visible = coins.filter((c) => !c.nsfw && c.mint !== ANSEM_MINT);
  const hotMints = [...visible]
    .sort(
      (a, b) =>
        (airdropMcapUsd(b.priceUsd, b.airdropTotal) || b.marketCapUsd || 0) -
        (airdropMcapUsd(a.priceUsd, a.airdropTotal) || a.marketCapUsd || 0),
    )
    .map((c) => c.mint);
  const freshDex = await hotDex(hotMints, store.dex, now);
  const dex: Record<string, DexCache> = { ...store.dex };
  for (const [mint, live] of Object.entries(freshDex)) dex[mint] = { at: now, live };

  const discoveredMints = new Set(visible.map((c) => c.mint));
  const communityVisible = store.community.filter((p) => !p.hidden && !discoveredMints.has(p.mint));

  const needDex = communityVisible.filter((p) => !store.dex[p.mint]?.live).map((p) => p.mint);
  let communityDex: Record<string, DexLive> = {};
  if (needDex.length) {
    try {
      communityDex = await fetchDexBatch(needDex);
    } catch {
      communityDex = {};
    }
  }
  const extras = communityVisible.map((p) => {
    const live = store.dex[p.mint]?.live || communityDex[p.mint] || null;
    return { p, live, error: live ? null : "No pairs found" };
  });

  const projects: Project[] = [
    ...visible.map((c) => {
      const burn = c.creatorWallet ? store.burns[c.creatorWallet] : undefined;
      const holders = store.holders[c.mint];
      const boost = boostFor(c.slug, boosts, now);
      const listed = listedLive(c);
      const live = withAirdrop(overlayDex(listed, dex[c.mint]?.live), c.airdropTotal);
      const project: Project = {
        id: `ansem:${c.slug}`,
        source: "ansem",
        slug: c.slug,
        name: c.name,
        ticker: c.ticker,
        mint: c.mint,
        tier: mapTier(c.tier),
        launchWallet: c.creatorWallet || null,
        imageUrl: imageUrlFrom(c.imageUrl),
        bannerUrl: bannerUrlFrom(c),
        enhancedAt: c.enhancedAt || null,
        status: c.status || null,
        airdropTotal: c.airdropTotal ?? null,
        nsfw: false,
        burnAmount: 0,
        burnPriceRef: market?.priceUsd || 0,
        verifiedBurn: burn?.verifiedBurn ?? null,
        verifiedTxChecked: burn?.txChecked ?? null,
        verifiedAt: burn?.scannedAt ?? null,
        verifyExhausted: burn?.exhausted,
        addedAt: c.createdAt ? Date.parse(c.createdAt) : now,
        addedBy: null,
        reports: 0,
        hidden: false,
        live,
        lastUpdated: now,
        rankDelta: 0,
        holderTop10Pct: holders?.top10Pct ?? null,
        insiderPct: holders?.insiderPct ?? null,
        sniper: Boolean(holders?.sniper),
        walletProvenance: provenanceFromStore(
          c.creatorWallet || null,
          store.dossiers[c.mint],
          store.provenance[c.mint],
        ),
        ...boost,
        listedAirdropMcap: listed.airdropMcap,
        listedMarketCap: listed.marketCap,
        listedBurn: creditedBurn(c.mint, projectBurns).amount,
        listedBurners: creditedBurn(c.mint, projectBurns).burners,
        officialRank: null,
        officialDelta: null,
        score: 0,
        flags: [],
        launchCount: 0,
      };
      project.score = computeScore(project);
      return project;
    }),
    ...extras.map(({ p, live, error }) => {
      const burn = p.launchWallet ? store.burns[p.launchWallet] : undefined;
      const holders = store.holders[p.mint];
      const boost = boostFor(undefined, boosts, now);
      const project: Project = {
        id: p.id,
        source: "community",
        name: live?.name || p.name,
        ticker: live?.symbol,
        mint: p.mint,
        tier: p.tier,
        launchWallet: p.launchWallet,
        status: null,
        burnAmount: p.burnAmount,
        burnPriceRef: p.burnPriceRef || market?.priceUsd || 0,
        verifiedBurn: burn?.verifiedBurn ?? null,
        verifiedTxChecked: burn?.txChecked ?? null,
        verifiedAt: burn?.scannedAt ?? null,
        verifyExhausted: burn?.exhausted,
        addedAt: p.addedAt,
        addedBy: p.addedBy,
        reports: p.reports,
        hidden: p.hidden,
        live: live
          ? {
              priceUsd: live.priceUsd,
              marketCap: live.marketCap,
              fdv: live.fdv,
              airdropMcap: null,
              volume24h: live.volume24h,
              change24h: live.change24h,
              liquidity: live.liquidity,
              dexUrl: live.dexUrl,
              symbol: live.symbol,
              name: live.name,
              mcapSource: "dex" as const,
            }
          : null,
        lastUpdated: now,
        fetchError: error,
        rankDelta: 0,
        holderTop10Pct: holders?.top10Pct ?? null,
        insiderPct: holders?.insiderPct ?? null,
        sniper: Boolean(holders?.sniper),
        walletProvenance: provenanceFromStore(
          p.launchWallet,
          store.dossiers[p.mint],
          store.provenance[p.mint],
        ),
        ...boost,
        listedAirdropMcap: null,
        listedMarketCap: live?.marketCap ?? null,
        listedBurn: creditedBurn(p.mint, projectBurns).amount,
        listedBurners: creditedBurn(p.mint, projectBurns).burners,
        officialRank: null,
        officialDelta: null,
        score: 0,
        flags: [],
        launchCount: 0,
      };
      project.score = computeScore(project);
      return project;
    }),
  ];

  const counts = launchCounts(projects);
  for (const p of projects) {
    p.launchCount = p.launchWallet ? counts.get(p.launchWallet) || 0 : 0;
    p.flags = projectFlags(p);
  }

  const ranked = applyRanks(projects, store.rankSnapshot, isListedFeed(feedSource), indexMcap);
  const indexed = uniqueVerifiedBurns(store.burns);
  const coverage = coverageMeter(ranked, store.burns, {
    ledger: store.burnLedger,
    webhookAt: store.webhookAt,
    now,
  });

  return {
    projects: ranked,
    ansemPrice: market?.priceUsd ?? null,
    solPrice: market?.solUsd ?? null,
    stats: {
      coins: ranked.length,
      airdroppedUsd: stats.airdroppedUsd,
      burnedAnsem: stats.burnedAnsem,
      verifiedBurned: indexed.verifiedBurned,
      holders: stats.holders,
      boosted: ranked.filter((p) => p.boostPoints > 0).length,
      flagged: ranked.filter((p) => p.flags.some((f) => f.severity === "bad")).length,
      scannedWallets: indexed.scannedWallets,
      exhaustedWallets: indexed.exhaustedWallets,
      paidPending: coverage.paidPending,
      paidWallets: coverage.paidWallets,
      paidIndexed: coverage.paidIndexed,
      paidExhausted: coverage.paidExhausted,
      lastScanAt: store.scanCursor.at || null,
      lastBurnAt: coverage.lastBurnAt,
      webhookAt: coverage.webhookAt,
      coverageLive: coverage.coverageLive,
    },
    lastSynced: now,
    feedSource,
    tape: store.tape || [],
    alerts: notifyChannels(),
  };
}

function refreshBoard() {
  const memo = (g.__crosscheckBoard ??= { at: 0, value: null, inflight: null });
  if (memo.inflight) return memo.inflight;
  memo.inflight = assembleBoard()
    .then((value) => {
      memo.at = Date.now();
      memo.value = value;
      return value;
    })
    .finally(() => {
      memo.inflight = null;
    });
  return memo.inflight;
}

async function getBoard(live = false): Promise<BoardPayload> {
  const now = Date.now();
  const memo = g.__crosscheckBoard;
  const hit = memo?.value;
  const age = hit && memo ? now - memo.at : Infinity;
  if (!live && hit && age < BOARD_FRESH_MS) return hit;
  if (!live && hit && age < BOARD_STALE_MS) {
    void refreshBoard();
    return hit;
  }
  return refreshBoard();
}

/** Shared snapshot for page navigations. Live polls pass true to bypass the short TTL. */
export const buildBoard = cache(async (live = false): Promise<BoardPayload> => getBoard(live));

export function invalidateBoard() {
  const memo = g.__crosscheckBoard;
  if (!memo) return;
  memo.at = 0;
  memo.value = null;
}
