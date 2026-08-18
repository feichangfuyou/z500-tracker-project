import { describe, expect, it } from "vitest";
import { isListedFeed, paidPendingScans, uniqueVerifiedBurns } from "./coverage";
import type { BurnCache, Project } from "./types";

describe("isListedFeed", () => {
  it("treats live and cached ansem.io lists as listed", () => {
    expect(isListedFeed("ansem")).toBe(true);
    expect(isListedFeed("cache")).toBe(true);
    expect(isListedFeed("pump")).toBe(false);
    expect(isListedFeed("dex")).toBe(false);
  });
});

describe("uniqueVerifiedBurns", () => {
  it("sums each wallet once", () => {
    const burns: Record<string, BurnCache> = {
      a: {
        wallet: "a",
        verifiedBurn: 10,
        txChecked: 1,
        txBurned: 1,
        scannedAt: 1,
        cursor: null,
        exhausted: true,
        headSig: null,
      },
      b: {
        wallet: "b",
        verifiedBurn: 5,
        txChecked: 1,
        txBurned: 1,
        scannedAt: 1,
        cursor: "c",
        exhausted: false,
        headSig: "h",
      },
    };
    expect(uniqueVerifiedBurns(burns)).toEqual({
      verifiedBurned: 15,
      scannedWallets: 2,
      exhaustedWallets: 1,
    });
  });
});

describe("paidPendingScans", () => {
  it("counts Gold/Diamond wallets with no index yet", () => {
    const projects = [
      { tier: "Gold", launchWallet: "w1" },
      { tier: "Gold", launchWallet: "w1" },
      { tier: "Diamond", launchWallet: "w2" },
      { tier: "Free", launchWallet: "w3" },
    ] as Project[];
    expect(paidPendingScans(projects, { w2: { wallet: "w2" } as BurnCache })).toBe(1);
  });
});
