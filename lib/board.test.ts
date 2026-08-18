import { describe, expect, it } from "vitest";
import { applyRanks } from "./board";
import { computeScore } from "./score";
import type { LiveData, Project } from "./types";

function live(partial: Partial<LiveData> = {}): LiveData {
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

function project(partial: Partial<Project> & Pick<Project, "id" | "name" | "mint">): Project {
  const base: Project = {
    id: partial.id,
    source: "ansem",
    name: partial.name,
    mint: partial.mint,
    tier: "Free",
    launchWallet: null,
    burnAmount: 0,
    burnPriceRef: 1,
    verifiedBurn: null,
    verifiedTxChecked: null,
    verifiedAt: null,
    addedAt: 0,
    addedBy: null,
    reports: 0,
    hidden: false,
    live: live(),
    lastUpdated: 0,
    rankDelta: 0,
    boostPoints: 0,
    boostGolden: false,
    boostExpiresAt: null,
    listedAirdropMcap: 0,
    listedMarketCap: 0,
    officialRank: null,
    officialDelta: null,
    score: 0,
    flags: [],
    launchCount: 0,
  };
  const merged = { ...base, ...partial };
  merged.score = computeScore(merged);
  return merged;
}

describe("applyRanks", () => {
  it("marks a verified-burn coin as ranking above the official-like order", () => {
    const low = project({
      id: "ansem:a",
      name: "Alpha",
      mint: "mintA",
      listedAirdropMcap: 1000,
      listedMarketCap: 1000,
      live: live({ airdropMcap: 1000, marketCap: 1000 }),
    });
    const burned = project({
      id: "ansem:b",
      name: "Bravo",
      mint: "mintB",
      listedAirdropMcap: 10,
      listedMarketCap: 10,
      verifiedBurn: 100,
      burnPriceRef: 1,
      live: live({ airdropMcap: 10, marketCap: 10 }),
    });
    const ranked = applyRanks([low, burned], { at: 0, ranks: {} });
    const bravo = ranked.find((p) => p.id === "ansem:b");
    expect(bravo?.officialRank).toBe(2);
    expect(bravo?.officialDelta).toBeGreaterThan(0);
    expect(ranked[0].id).toBe("ansem:b");
  });

  it("does not assign a listed rank when the feed is not ansem.io", () => {
    const coin = project({
      id: "ansem:a",
      name: "Alpha",
      mint: "mintA",
      listedAirdropMcap: 1000,
      live: live({ airdropMcap: 1000 }),
    });
    const ranked = applyRanks([coin], { at: 0, ranks: {} }, false);
    expect(ranked[0]?.officialRank).toBeNull();
    expect(ranked[0]?.officialDelta).toBeNull();
  });
});
