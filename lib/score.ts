import { AIRDROP_WEIGHT, BOOST_WEIGHT, BURN_USD_WEIGHT, type Project } from "./types";

export { AIRDROP_WEIGHT, BOOST_WEIGHT, BURN_USD_WEIGHT };

export function effectiveBurn(p: Pick<Project, "verifiedBurn" | "burnAmount">) {
  return p.verifiedBurn !== undefined && p.verifiedBurn !== null
    ? p.verifiedBurn
    : p.burnAmount || 0;
}

/** Burns z500 credits to the coin (project leaderboard), else launch-wallet verified. */
export function publicBurn(
  p: Pick<Project, "verifiedBurn"> & { burnAmount?: number; listedBurn?: number | null },
) {
  if (p.listedBurn != null) return p.listedBurn;
  return effectiveBurn({ verifiedBurn: p.verifiedBurn, burnAmount: p.burnAmount || 0 });
}

export function airdropMcapUsd(price: number | null | undefined, total: number | null | undefined) {
  if (!price || !total) return null;
  return price * total;
}

function mcapInput(airdropMcap: number | null | undefined, circulating: number | null | undefined) {
  if (airdropMcap && airdropMcap > 0) return airdropMcap;
  return circulating || 0;
}

export type ScoreMcapSource = "airdrop" | "circulating";

export type ScoreParts = {
  airdropMcap: number;
  circulatingMcap: number;
  mcapUsed: number;
  mcapSource: ScoreMcapSource;
  airdrop: number;
  burnTokens: number;
  burnUsd: number;
  burns: number;
  boostPoints: number;
  boosts: number;
  total: number;
};

export type ScoreInput = Pick<Project, "live" | "verifiedBurn" | "burnPriceRef"> & {
  burnAmount?: number;
  boostPoints?: number;
  listedBurn?: number | null;
  launchWallet?: string | null;
  verifyExhausted?: boolean;
};

export type BurnSource = "listed" | "on-chain" | "partial" | "pending" | "entered" | "none";

export function burnSource(p: {
  verifiedBurn?: number | null;
  listedBurn?: number | null;
  launchWallet?: string | null;
  verifyExhausted?: boolean;
  burnAmount?: number;
}): BurnSource {
  if (p.listedBurn != null) return "listed";
  if (!p.launchWallet) return p.burnAmount && p.burnAmount > 0 ? "entered" : "none";
  if (p.verifiedBurn == null) return "pending";
  return p.verifyExhausted ? "on-chain" : "partial";
}

export function burnSourceLabel(source: BurnSource) {
  if (source === "listed") return "listed";
  if (source === "on-chain") return "on-chain";
  if (source === "partial") return "partial";
  if (source === "pending") return "pending";
  if (source === "entered") return "entered";
  return "";
}

/** Published Crosscheck v1: airdropped-supply mcap × 0.6 + burn USD × 40 + boost points × 250. */
export const SCORE_FORMULA =
  "score = airdrop_mcap × 0.6 + ($ANSEM_burned × $ANSEM_price × 40) + (boost_points × 250)";

export const SCORE_KIND = "crosscheck-v1" as const;

export function scoreParts(p: ScoreInput): ScoreParts {
  const airdropMcap = p.live?.airdropMcap || 0;
  const circulatingMcap = p.live?.marketCap || 0;
  const mcapUsed = mcapInput(airdropMcap, circulatingMcap);
  const mcapSource: ScoreMcapSource = airdropMcap > 0 ? "airdrop" : "circulating";
  const burnTokens = publicBurn(p);
  const burnUsd = burnTokens * (p.burnPriceRef || 0);
  const boostPoints = p.boostPoints || 0;
  const airdrop = mcapUsed * AIRDROP_WEIGHT;
  const burns = burnUsd * BURN_USD_WEIGHT;
  const boosts = boostPoints * BOOST_WEIGHT;
  return {
    airdropMcap,
    circulatingMcap,
    mcapUsed,
    mcapSource,
    airdrop,
    burnTokens,
    burnUsd,
    burns,
    boostPoints,
    boosts,
    total: airdrop + burns + boosts,
  };
}

export function computeScore(p: ScoreInput) {
  return scoreParts(p).total;
}

/** z500’s default sort: circulating mcap from ansem.io. Never Dex overlay. */
export function officialScore(p: {
  listedAirdropMcap?: number | null;
  listedMarketCap?: number | null;
  live?: { marketCap?: number | null } | null;
  boostPoints?: number;
}) {
  return p.listedMarketCap || 0;
}

export function ranksFromOrder(ids: string[]) {
  const ranks: Record<string, number> = {};
  ids.forEach((id, i) => {
    ranks[id] = i + 1;
  });
  return ranks;
}

/** Positive = Crosscheck ranks the coin higher than the listed-order estimate. */
export function officialDelta(officialRank: number | null | undefined, crosscheckRank: number) {
  if (!officialRank) return null;
  return officialRank - crosscheckRank;
}
