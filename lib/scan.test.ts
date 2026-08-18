import { describe, expect, it } from "vitest";
import { nextScanTargets, pendingFirstPass, scanBudget, type ScanTarget } from "./scan";
import type { BurnCache } from "./types";

function burn(partial: Partial<BurnCache>): BurnCache {
  return {
    wallet: "w",
    verifiedBurn: 0,
    txChecked: 40,
    txBurned: 0,
    scannedAt: 1_000,
    cursor: "c",
    exhausted: true,
    headSig: "h",
    ...partial,
  };
}

const now = 1_000_000;

describe("nextScanTargets", () => {
  const targets: ScanTarget[] = [
    { wallet: "fresh", mint: "a", tier: "Free", addedAt: now },
    { wallet: "diamond", mint: "b", tier: "Diamond", addedAt: now },
    { wallet: "stale", mint: "c", tier: "Gold", addedAt: now },
    { wallet: "continue", mint: "d", tier: "Free", addedAt: now },
  ];

  it("resumes unfinished wallets before first-pass and stale ones", () => {
    const burns = {
      fresh: burn({ wallet: "fresh", exhausted: true, scannedAt: now - 1000 }),
      stale: burn({ wallet: "stale", exhausted: true, scannedAt: now - 7 * 60 * 60 * 1000 }),
      continue: burn({ wallet: "continue", exhausted: false, scannedAt: now - 1000 }),
    };
    const next = nextScanTargets(targets, burns, 10, now).map((t) => t.wallet);
    expect(next[0]).toBe("continue");
    expect(next).toContain("diamond");
    expect(next).toContain("stale");
    expect(next).not.toContain("fresh");
  });

  it("reopens pre-Helius caches when a native index is available", () => {
    const burns = {
      fresh: burn({ wallet: "fresh", exhausted: true, scannedAt: now - 1000 }),
      continue: burn({ wallet: "continue", exhausted: false, scannedAt: now - 5000, indexedBy: "helius" as const }),
    };
    const next = nextScanTargets(targets, burns, 10, now, true).map((t) => t.wallet);
    expect(next).toContain("fresh");
    expect(next[0]).toBe("continue");
  });

  it("dedupes wallets and respects the limit", () => {
    const dupes: ScanTarget[] = [
      { wallet: "w1", mint: "a", tier: "Free", addedAt: 1 },
      { wallet: "w1", mint: "b", tier: "Gold", addedAt: 2 },
      { wallet: "w2", mint: "c", tier: "Free", addedAt: 3 },
    ];
    expect(nextScanTargets(dupes, {}, 10, now).map((t) => t.wallet)).toEqual(["w2", "w1"]);
    expect(nextScanTargets(dupes, {}, 1, now)).toHaveLength(1);
  });

  it("bursts first-pass wallets and skips stale heads", () => {
    const burns = {
      stale: burn({ wallet: "stale", exhausted: true, scannedAt: now - 7 * 60 * 60 * 1000, indexedBy: "helius" as const }),
      continue: burn({ wallet: "continue", exhausted: false, scannedAt: now - 1000 }),
    };
    const next = nextScanTargets(targets, burns, 10, now, true, true).map((t) => t.wallet);
    expect(next[0]).toBe("diamond");
    expect(next[1]).toBe("fresh");
    expect(next[2]).toBe("continue");
    expect(next).not.toContain("stale");
    expect(pendingFirstPass(targets, burns)).toBe(3);
    expect(scanBudget(200)).toBeGreaterThan(scanBudget(0));
    expect(scanBudget(1)).toBeGreaterThanOrEqual(24);
  });

  it("reopens paid exhausted wallets within minutes so a bad add cannot sit", () => {
    const burns = {
      diamond: burn({ wallet: "diamond", exhausted: true, scannedAt: now - 6 * 60 * 1000, indexedBy: "helius" }),
      continue: burn({ wallet: "continue", exhausted: true, scannedAt: now - 6 * 60 * 1000, indexedBy: "helius" }),
    };
    const next = nextScanTargets(targets, burns, 10, now).map((t) => t.wallet);
    expect(next).toContain("diamond");
    expect(next).not.toContain("continue");
  });

  it("recounts a doubled Diamond burn immediately", () => {
    const burns = {
      diamond: burn({
        wallet: "diamond",
        exhausted: true,
        scannedAt: now - 1_000,
        verifiedBurn: 741_016,
        indexedBy: "helius",
      }),
    };
    expect(nextScanTargets(targets, burns, 10, now).map((t) => t.wallet)[0]).toBe("diamond");
  });
});
