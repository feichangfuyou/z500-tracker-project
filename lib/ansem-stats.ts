import { fmtHead, fmtUsd } from "./format";

export type AnsemStats = {
  airdroppedTokens: number | null;
  airdroppedUsd: number | null;
  airdroppedUsdNow: number | null;
  airdroppedCoins: number | null;
  airdroppedWallets: number | null;
  airdroppedPricedShare: number | null;
  claimedTokens: number | null;
  burnedAnsem: number | null;
  holders: number | null;
};

export const EMPTY_ANSEM_STATS: AnsemStats = {
  airdroppedTokens: null,
  airdroppedUsd: null,
  airdroppedUsdNow: null,
  airdroppedCoins: null,
  airdroppedWallets: null,
  airdroppedPricedShare: null,
  claimedTokens: null,
  burnedAnsem: null,
  holders: null,
};

export type AnsemStatsJson = {
  airdropped?: {
    tokens?: number;
    claimedTokens?: number;
    usd?: number;
    usdNow?: number;
    pricedShare?: number;
    coins?: number;
    wallets?: number;
  };
  holders?: { count?: number };
  burned?: { total?: number };
};

function num(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? null : n;
}

export function mapAnsemStats(json: AnsemStatsJson | null | undefined): AnsemStats {
  const a = json?.airdropped;
  return {
    airdroppedTokens: num(a?.tokens),
    airdroppedUsd: num(a?.usd),
    airdroppedUsdNow: num(a?.usdNow),
    airdroppedCoins: num(a?.coins),
    airdroppedWallets: num(a?.wallets),
    airdroppedPricedShare: num(a?.pricedShare),
    claimedTokens: num(a?.claimedTokens),
    burnedAnsem: num(json?.burned?.total),
    holders: num(json?.holders?.count),
  };
}

/** Same caption ansem.io prints under “Airdropped to holders”. */
export function listedAirdropCaption(
  s: Pick<
    AnsemStats,
    "airdroppedTokens" | "airdroppedUsd" | "airdroppedCoins" | "airdroppedWallets" | "airdroppedPricedShare"
  >,
) {
  if (!(s.airdroppedTokens && s.airdroppedTokens > 0)) return "Distributed at migration";
  const usd =
    s.airdroppedUsd != null
      ? `≈ ${fmtUsd(s.airdroppedUsd)}${(s.airdroppedPricedShare ?? 1) < 0.999 ? "+" : ""}`
      : null;
  const coins = s.airdroppedCoins != null ? `${s.airdroppedCoins} coin${s.airdroppedCoins === 1 ? "" : "s"}` : null;
  const wallets = s.airdroppedWallets != null ? `${fmtHead(s.airdroppedWallets)} wallets` : null;
  return [usd, coins, wallets].filter(Boolean).join(" · ") || "Distributed at migration";
}
