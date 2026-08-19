import { BOOST_WEIGHT, type Project } from "./types";

export { BOOST_WEIGHT };

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

/** Directional proxy: airdropped-supply mcap + burn value + active boosts. Not the official index formula. */
export function computeScore(
  p: Pick<Project, "live" | "verifiedBurn" | "burnPriceRef"> & {
    burnAmount?: number;
    boostPoints?: number;
    listedBurn?: number | null;
  },
) {
  const mcap = mcapInput(p.live?.airdropMcap, p.live?.marketCap);
  const burnUsd = publicBurn(p) * (p.burnPriceRef || 0);
  return mcap * 0.6 + burnUsd * 40 + (p.boostPoints || 0) * BOOST_WEIGHT;
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
