import { ansemCoinUrl } from "./links";
import { CDN_CACHE_LONG } from "./http";
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

export function publicCoin(p: Project) {
  return {
    mint: p.mint,
    name: p.name,
    ticker: p.ticker || null,
    slug: p.slug || null,
    tier: p.tier,
    status: p.status || null,
    score: p.score,
    officialRank: p.officialRank,
    officialDelta: p.officialDelta,
    marketCap: p.live?.marketCap ?? null,
    airdropMcap: p.live?.airdropMcap ?? null,
    burned: p.verifiedBurn,
    boostPoints: p.boostPoints,
    flags: p.flags,
    launchWallet: p.launchWallet,
    provenance: p.walletProvenance || "unknown",
    imageUrl: p.imageUrl || null,
    bannerUrl: p.bannerUrl || null,
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
    imageUrl: p.imageUrl || null,
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
  if (key === "flags" || key === "tape" || key === "alerts" || key === "projects") return value;
  if (value == null || value === false || value === "") return undefined;
  return value;
}

export function compactBoard(
  board: Omit<BoardResponse, "sid"> & { sid?: string },
  opts?: { lite?: boolean },
): Omit<BoardResponse, "sid"> {
  const tape: TapeEvent[] = (board.tape || []).slice(0, opts?.lite ? 12 : 40);
  const projects = board.projects.map((p) => {
    const row = compactProject(p);
    if (opts?.lite) row.imageUrl = null;
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
