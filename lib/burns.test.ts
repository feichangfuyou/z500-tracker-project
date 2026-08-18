import { describe, expect, it } from "vitest";
import { applyBurnScan } from "./burns";
import { headScanApply } from "./helius";
import type { BurnCache } from "./types";

function prev(partial: Partial<BurnCache> = {}): BurnCache {
  return {
    wallet: "w",
    verifiedBurn: 370_508,
    txChecked: 2,
    txBurned: 1,
    scannedAt: 1,
    cursor: "old",
    exhausted: true,
    headSig: "head",
    indexedBy: "helius",
    ...partial,
  };
}

describe("headScanApply", () => {
  it("adds only when the known head signature is hit", () => {
    expect(headScanApply(true, false, 1)).toBe("add");
  });

  it("replaces when a short page is a full recount without the old head", () => {
    expect(headScanApply(false, true, 2)).toBe("replace");
  });

  it("skips an incomplete head window", () => {
    expect(headScanApply(false, false, 100)).toBe("skip");
  });
});

describe("applyBurnScan", () => {
  it("does not add a full recount on top of an existing Diamond burn", () => {
    const next = applyBurnScan("w", prev(), {
      verifiedBurn: 370_508,
      txChecked: 2,
      txBurned: 1,
      cursor: "old",
      exhausted: true,
      headSig: "head",
      replace: true,
      indexedBy: "helius",
    });
    expect(next.verifiedBurn).toBe(370_508);
  });

  it("adds only new head burns", () => {
    const next = applyBurnScan("w", prev(), {
      verifiedBurn: 12,
      txChecked: 1,
      txBurned: 1,
      cursor: "old",
      exhausted: true,
      headSig: "new",
      replace: false,
      indexedBy: "helius",
    });
    expect(next.verifiedBurn).toBe(370_520);
  });
});
