import { describe, expect, it } from "vitest";
import { rankAfterScore, scoreWithExtraBurn, simulateBurn } from "./sim";
import type { LiveData } from "./types";

const live: LiveData = {
  priceUsd: 1,
  marketCap: 1000,
  fdv: 1000,
  airdropMcap: 1000,
  volume24h: null,
  change24h: null,
  liquidity: null,
  dexUrl: null,
  symbol: "A",
  name: "A",
};

describe("simulateBurn", () => {
  it("moves a coin up when extra burns add enough score", () => {
    const low = {
      mint: "low",
      score: 600,
      live,
      verifiedBurn: 0,
      burnAmount: 0,
      burnPriceRef: 1,
      boostPoints: 0,
    };
    const high = {
      mint: "high",
      score: 900,
      live: { ...live, airdropMcap: 1500, marketCap: 1500 },
      verifiedBurn: 0,
      burnAmount: 0,
      burnPriceRef: 1,
      boostPoints: 0,
    };
    const extra = 20;
    expect(scoreWithExtraBurn(low, extra)).toBeGreaterThan(low.score);
    const sim = simulateBurn([high, { ...low, score: 600 }], "low", extra);
    expect(sim?.delta).toBeGreaterThan(0);
    expect(rankAfterScore([{ mint: "high", score: 900 }, { mint: "low", score: 1400 }], "low", 1400)).toBe(1);
  });
});
