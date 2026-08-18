import { describe, expect, it } from "vitest";
import { DIAMOND_BURN, GOLD_BURN, paidRadar, radarReasons, radarStats, tierBurnFloor } from "./paid-radar";
import type { Project } from "./types";

function project(partial: Partial<Project> & Pick<Project, "name" | "mint" | "tier">): Project {
  return {
    id: `ansem:${partial.mint}`,
    source: "ansem",
    burnAmount: 0,
    burnPriceRef: 0,
    verifiedBurn: null,
    verifiedTxChecked: null,
    verifiedAt: null,
    addedAt: 1,
    addedBy: null,
    reports: 0,
    hidden: false,
    live: null,
    lastUpdated: null,
    rankDelta: 0,
    boostPoints: 0,
    boostGolden: false,
    boostExpiresAt: null,
    listedAirdropMcap: null,
    listedMarketCap: null,
    officialRank: null,
    officialDelta: null,
    score: 0,
    flags: [],
    launchCount: 1,
    launchWallet: "Wallet1111111111111111111111111111111111111",
    ...partial,
  };
}

describe("tierBurnFloor", () => {
  it("uses ansem.io Gold and Diamond thresholds", () => {
    expect(tierBurnFloor("Gold")).toBe(GOLD_BURN);
    expect(tierBurnFloor("Diamond")).toBe(DIAMOND_BURN);
    expect(tierBurnFloor("Free")).toBeNull();
  });
});

describe("radarReasons", () => {
  it("keeps a clean exhausted Diamond off the list", () => {
    expect(
      radarReasons({
        tier: "Diamond",
        verifiedBurn: DIAMOND_BURN,
        verifyExhausted: true,
        walletProvenance: "matched",
        sniper: false,
        launchCount: 1,
      }),
    ).toEqual([]);
  });

  it("flags pending, under-floor, mismatch, serial, and sniper", () => {
    expect(radarReasons({ tier: "Gold", verifiedBurn: null, verifyExhausted: false }).map((r) => r.id)).toEqual([
      "pending",
    ]);
    expect(
      radarReasons({ tier: "Gold", verifiedBurn: 1_000, verifyExhausted: false }).find((r) => r.id === "partial"),
    ).toBeTruthy();
    expect(
      radarReasons({ tier: "Diamond", verifiedBurn: 200_000, verifyExhausted: true }).find((r) => r.id === "short")
        ?.severity,
    ).toBe("warn");
    expect(
      radarReasons({
        tier: "Gold",
        verifiedBurn: GOLD_BURN,
        verifyExhausted: true,
        walletProvenance: "mismatch",
        sniper: true,
        launchCount: 8,
      }).map((r) => r.id),
    ).toEqual(["mismatch", "sniper", "serial"]);
  });
});

describe("paidRadar", () => {
  it("lists only stained Gold and Diamond, worst first", () => {
    const rows = paidRadar([
      project({ name: "Free", mint: "f", tier: "Free", verifiedBurn: 0 }),
      project({ name: "Clean", mint: "c", tier: "Gold", verifiedBurn: GOLD_BURN, verifyExhausted: true }),
      project({
        name: "Gap",
        mint: "g",
        tier: "Diamond",
        verifiedBurn: 0,
        verifyExhausted: true,
        officialRank: 9,
      }),
      project({
        name: "Mismatch",
        mint: "m",
        tier: "Gold",
        verifiedBurn: GOLD_BURN,
        verifyExhausted: true,
        walletProvenance: "mismatch",
        officialRank: 2,
      }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Gap", "Mismatch"]);
    expect(rows[0]?.reasons[0]?.id).toBe("short");
    const stats = radarStats([
      project({ name: "Free", mint: "f", tier: "Free" }),
      project({ name: "Clean", mint: "c", tier: "Gold", verifiedBurn: GOLD_BURN, verifyExhausted: true }),
      project({ name: "Gap", mint: "g", tier: "Diamond", verifiedBurn: 0, verifyExhausted: true }),
      project({
        name: "Mismatch",
        mint: "m",
        tier: "Gold",
        verifiedBurn: GOLD_BURN,
        verifyExhausted: true,
        walletProvenance: "mismatch",
      }),
    ]);
    expect(stats.paid).toBe(3);
    expect(stats.flagged).toBe(2);
    expect(stats.burnGaps).toBe(1);
    expect(stats.mismatch).toBe(1);
  });
});
