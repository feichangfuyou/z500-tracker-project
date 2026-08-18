import { BOOST_WEIGHT, type Project } from "./types";

export { BOOST_WEIGHT };

export function effectiveBurn(p: Pick<Project, "verifiedBurn" | "burnAmount">) {
  return p.verifiedBurn !== undefined && p.verifiedBurn !== null
    ? p.verifiedBurn
    : p.burnAmount || 0;
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
  p: Pick<Project, "live" | "verifiedBurn" | "burnAmount" | "burnPriceRef"> & { boostPoints?: number },
) {
  const mcap = mcapInput(p.live?.airdropMcap, p.live?.marketCap);
  const burnUsd = effectiveBurn(p) * (p.burnPriceRef || 0);
  return mcap * 0.6 + burnUsd * 40 + (p.boostPoints || 0) * BOOST_WEIGHT;
}

/** Listed-order estimate from public ansem.io inputs. Not the unpublished z500 formula. */
export function officialScore(p: {
  listedAirdropMcap?: number | null;
  listedMarketCap?: number | null;
  boostPoints?: number;
}) {
  const mcap = mcapInput(p.listedAirdropMcap, p.listedMarketCap);
  return mcap * 0.6 + (p.boostPoints || 0) * BOOST_WEIGHT;
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
