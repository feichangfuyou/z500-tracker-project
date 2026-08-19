import { ansemCoinUrl } from "./links";
import { burnCoverage } from "./coverage";
import { publicProvenance } from "./flags";
import { CDN_CACHE_LONG } from "./http";
import { publicImageUrl } from "./media";
import { publicBurn, SCORE_FORMULA, SCORE_KIND, scoreParts } from "./score";
import type { BoardResponse, Project, TapeEvent } from "./types";

export const PUBLIC_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export const PUBLIC_HEADERS = {
  ...PUBLIC_CORS,
  ...CDN_CACHE_LONG,
};

export const RANK_NOTE =
  "officialRank follows z500’s default sort: circulating market cap, including $ANSEM at #1 and NSFW launches. burned is the project total ansem.io credits (all burners). independentlyBurned is $ANSEM we assigned to this coin (launch wallet plus stranger burns we could label). walletBurned is the listed-launch-wallet scan only. burnCoveragePct is independentlyBurned ÷ burned. Unlabeled burns stay unlabeled. score is Crosscheck v1: airdrop_mcap × 0.6 + ($ANSEM_burned × $ANSEM_price × 40) + (boost_points × 250). If airdrop_mcap is 0 we use circulating mcap. Not z500.";

export function publicCoin(p: Project) {
  const coverage = burnCoverage(p);
  const parts = scoreParts(p);
  return {
    mint: p.mint,
    name: p.name,
    ticker: p.ticker || null,
    slug: p.slug || null,
    tier: p.tier,
    status: p.status || null,
    score: p.score,
    scoreKind: SCORE_KIND,
    scoreFormula: SCORE_FORMULA,
    scoreParts: {
      airdrop: parts.airdrop,
      burns: parts.burns,
      boosts: parts.boosts,
      mcapSource: parts.mcapSource,
      total: parts.total,
    },
    officialRank: p.officialRank,
    listedRank: p.officialRank,
    officialDelta: p.officialDelta,
    dayDelta: p.dayDelta || 0,
    rankBasis: "z500-mcap" as const,
    marketCap: p.live?.marketCap ?? null,
    airdropMcap: p.live?.airdropMcap ?? null,
    airdropTotal: p.airdropTotal ?? null,
    nsfw: Boolean(p.nsfw),
    txns24h: p.txns24h ?? null,
    burned: publicBurn(p),
    listedBurned: p.listedBurn ?? null,
    independentlyBurned: p.verifiedBurn,
    walletBurned: p.walletBurned ?? p.verifiedBurn,
    burnedComplete: coverage.status === "complete" && p.listedBurn != null,
    walletScanComplete: Boolean(p.verifyExhausted),
    burnCoveragePct: coverage.pct,
    burnCoverageStatus: coverage.status,
    listedBurners: p.listedBurners ?? null,
    boostPoints: p.boostPoints,
    flags: p.flags,
    launchWallet: p.launchWallet,
    provenance: publicProvenance(p.walletProvenance),
    imageUrl: publicImageUrl(p.imageUrl),
    bannerUrl: publicImageUrl(p.bannerUrl),
    enhancedAt: p.enhancedAt || null,
    ansemUrl: ansemCoinUrl(p.slug),
    launchCount: p.launchCount || 0,
  };
}

function compactLive(live: Project["live"]) {
  if (!live) return null;
  return {
    priceUsd: live.priceUsd,
    marketCap: live.marketCap,
    airdropMcap: live.airdropMcap,
    volume24h: live.volume24h,
    change24h: live.change24h,
    liquidity: live.liquidity,
  };
}

export function compactProject(p: Project): Project {
  return {
    id: p.id,
    source: p.source,
    slug: p.slug,
    name: p.name,
    ticker: p.ticker,
    mint: p.mint,
    tier: p.tier,
    launchWallet: p.launchWallet,
    imageUrl: publicImageUrl(p.imageUrl),
    status: p.status || null,
    airdropTotal: p.airdropTotal ?? null,
    txns24h: p.txns24h ?? null,
    listedVolume24h: p.listedVolume24h ?? null,
    listedChange24h: p.listedChange24h ?? null,
    nsfw: p.nsfw,
    burnAmount: 0,
    burnPriceRef: p.burnPriceRef,
    verifiedBurn: p.verifiedBurn,
    walletBurned: p.walletBurned,
    verifiedTxChecked: null,
    verifiedAt: null,
    verifyExhausted: p.verifyExhausted,
    addedAt: p.addedAt,
    addedBy: p.addedBy,
    reports: p.reports,
    hidden: false,
    live: compactLive(p.live) as Project["live"],
    lastUpdated: null,
    fetchError: p.fetchError,
    rankDelta: p.rankDelta,
    dayDelta: p.dayDelta || 0,
    holderTop10Pct: p.holderTop10Pct,
    sniper: p.sniper,
    walletProvenance: p.walletProvenance,
    boostPoints: p.boostPoints,
    boostGolden: p.boostGolden,
    boostExpiresAt: p.boostExpiresAt,
    listedAirdropMcap: null,
    listedMarketCap: p.listedMarketCap,
    listedBurn: p.listedBurn,
    listedBurners: p.listedBurners,
    officialRank: p.officialRank,
    officialDelta: p.officialDelta,
    score: p.score,
    flags: p.flags,
    launchCount: p.launchCount,
  };
}

function dropEmpty(key: string, value: unknown) {
  if (key === "tape" || key === "alerts" || key === "projects" || key === "walletProvenance") return value;
  if (value == null || value === false || value === "" || (Array.isArray(value) && value.length === 0)) {
    return undefined;
  }
  return value;
}

export const BOARD_SEED = 20;

export function listedProjects(projects: Project[]) {
  return [...projects].sort(
    (a, b) => (a.officialRank ?? 9_999) - (b.officialRank ?? 9_999) || a.name.localeCompare(b.name),
  );
}

export function compactBoard(
  board: Omit<BoardResponse, "sid"> & { sid?: string },
  opts?: { lite?: boolean },
): Omit<BoardResponse, "sid"> {
  const tape: TapeEvent[] = (board.tape || []).slice(0, opts?.lite ? 12 : 40);
  const projects = board.projects.map((p) => {
    const row = compactProject(p);
    if (opts?.lite) {
      row.imageUrl = null;
      row.addedAt = 0;
      row.addedBy = null;
      row.reports = 0;
    }
    return row;
  });
  return JSON.parse(
    JSON.stringify(
      {
        ...board,
        sid: undefined,
        projects,
        tape,
      },
      dropEmpty,
    ),
  ) as Omit<BoardResponse, "sid">;
}

/** First listed page for SSR. Client hydrates the rest from /api/board?lite=1. */
export function seedBoard(board: Omit<BoardResponse, "sid"> & { sid?: string }): Omit<BoardResponse, "sid"> {
  const compact = compactBoard(board);
  return { ...compact, projects: listedProjects(compact.projects).slice(0, BOARD_SEED) };
}
