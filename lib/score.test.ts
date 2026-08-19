import { describe, expect, it } from "vitest";
import { computeScore, effectiveBurn, publicBurn } from "./score";
import type { LiveData } from "./types";

function live(partial: Partial<LiveData>): LiveData {
  return {
    priceUsd: null,
    marketCap: null,
    fdv: null,
    airdropMcap: null,
    volume24h: null,
    change24h: null,
    liquidity: null,
    dexUrl: null,
    symbol: "",
    name: "",
    ...partial,
  };
}

describe("effectiveBurn", () => {
  it("prefers onchain verified over self-reported", () => {
    expect(effectiveBurn({ verifiedBurn: 12, burnAmount: 99 })).toBe(12);
  });
  it("falls back to self-reported", () => {
    expect(effectiveBurn({ verifiedBurn: null, burnAmount: 7 })).toBe(7);
  });
});

describe("publicBurn", () => {
  it("prefers the project total z500 credits over the launch-wallet scan", () => {
    expect(publicBurn({ verifiedBurn: 0, burnAmount: 0, listedBurn: 370_566 })).toBe(370_566);
    expect(publicBurn({ verifiedBurn: 163_505, burnAmount: 0, listedBurn: 0 })).toBe(0);
    expect(publicBurn({ verifiedBurn: 12, burnAmount: 99 })).toBe(12);
  });
});

describe("computeScore", () => {
  const base = { verifiedBurn: 0, burnAmount: 0, burnPriceRef: 0 };

  it("uses airdropped-supply mcap when present", () => {
    expect(computeScore({ ...base, live: live({ airdropMcap: 1000, marketCap: 50_000, fdv: 80_000 }) })).toBe(600);
    expect(computeScore({ ...base, live: live({ marketCap: 50_000, fdv: 80_000 }) })).toBe(30_000);
  });

  it("adds burn value at weight 40", () => {
    expect(computeScore({ verifiedBurn: 10, burnAmount: 0, burnPriceRef: 2, live: live({}) })).toBe(800);
  });

  it("adds active boost points", () => {
    expect(computeScore({ verifiedBurn: 0, burnAmount: 0, burnPriceRef: 0, boostPoints: 10, live: live({}) })).toBe(2500);
  });
});
