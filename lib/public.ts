import { ansemCoinUrl } from "./links";
import { publicProvenance } from "./flags";
import { CDN_CACHE_LONG } from "./http";
import { publicImageUrl } from "./media";
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
  "officialRank is a listed-order estimate from public ansem.io inputs (airdrop value + boosts), not the unpublished z500 formula. score is a Crosscheck proxy that also uses verified burns.";

export function publicCoin(p: Project) {
  return {
    mint: p.mint,
    name: p.name,
    ticker: p.ticker || null,
    slug: p.slug || null,
    tier: p.tier,
    status: p.status || null,
    score: p.score,
    scoreKind: "proxy" as const,
    officialRank: p.officialRank,
    listedRank: p.officialRank,
    officialDelta: p.officialDelta,
    rankBasis: "listed-inputs" as const,
    marketCap: p.live?.marketCap ?? null,
    airdropMcap: p.live?.airdropMcap ?? null,
    burned: p.verifiedBurn,
    burnedComplete: Boolean(p.verifyExhausted),
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
    burnAmount: 0,
    burnPriceRef: 0,
    verifiedBurn: p.verifiedBurn,
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
    holderTop10Pct: p.holderTop10Pct,
    sniper: p.sniper,
    walletProvenance: p.walletProvenance,
    boostPoints: p.boostPoints,
    boostGolden: p.boostGolden,
    boostExpiresAt: p.boostExpiresAt,
    listedAirdropMcap: null,
    listedMarketCap: null,
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
