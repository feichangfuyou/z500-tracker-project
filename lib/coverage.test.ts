import { describe, expect, it } from "vitest";
import { ansemAccuracy, burnCoverage, burnVerifiedPct, coverageMeter, isListedFeed, listedBurnTotal, paidPendingScans, unlabeledLedger, uniqueVerifiedBurns } from "./coverage";
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
  it("counts Gold/Diamond wallets that are missing or still open", () => {
    const projects = [
      { tier: "Gold", launchWallet: "w1" },
      { tier: "Gold", launchWallet: "w1" },
      { tier: "Diamond", launchWallet: "w2" },
      { tier: "Free", launchWallet: "w3" },
    ] as Project[];
    expect(paidPendingScans(projects, { w2: { wallet: "w2" } as BurnCache })).toBe(2);
    expect(
      paidPendingScans(projects, {
        w1: { wallet: "w1", exhausted: true } as BurnCache,
        w2: { wallet: "w2", exhausted: true } as BurnCache,
      }),
    ).toBe(0);
  });
});

describe("coverageMeter", () => {
  it("counts paid wallets and live webhook age", () => {
    const projects = [
      { tier: "Gold", launchWallet: "w1" },
      { tier: "Diamond", launchWallet: "w2" },
      { tier: "Free", launchWallet: "w3" },
    ] as Project[];
    const burns = {
      w1: { wallet: "w1", exhausted: true } as BurnCache,
    };
    const meter = coverageMeter(projects, burns, {
      ledger: [{ signature: "s", wallet: "w1", amount: 1, at: 50 }],
      webhookAt: 90,
      now: 100,
    });
    expect(meter.paidWallets).toBe(2);
    expect(meter.paidIndexed).toBe(1);
    expect(meter.paidExhausted).toBe(1);
    expect(meter.paidPending).toBe(1);
    expect(meter.lastBurnAt).toBe(50);
    expect(meter.coverageLive).toBe(true);
    expect(meter.mintExhausted).toBe(false);
    expect(meter.mintTxChecked).toBe(0);
  });

  it("treats an indexed-but-unfinished paid wallet as still scanning", () => {
    const projects = [
      { tier: "Gold", launchWallet: "w1" },
      { tier: "Diamond", launchWallet: "w2" },
    ] as Project[];
    const meter = coverageMeter(projects, {
      w1: { wallet: "w1", exhausted: true } as BurnCache,
      w2: { wallet: "w2", exhausted: false } as BurnCache,
    });
    expect(meter.paidIndexed).toBe(2);
    expect(meter.paidExhausted).toBe(1);
    expect(meter.paidPending).toBe(1);
    const minted = coverageMeter(projects, {
      w1: { wallet: "w1", exhausted: true } as BurnCache,
      w2: { wallet: "w2", exhausted: false } as BurnCache,
    }, { mintIndex: { exhausted: true, txChecked: 400 } });
    expect(minted.mintExhausted).toBe(true);
    expect(minted.mintTxChecked).toBe(400);
  });
});

describe("burnCoverage", () => {
  it("flags credited burns the launch wallet did not hold as unlabeled", () => {
    expect(burnCoverage({ tier: "Diamond", verifiedBurn: 0, listedBurn: 370_566, listedBurners: 3 }).status).toBe(
      "unlabeled",
    );
    expect(burnCoverage({ tier: "Diamond", verifiedBurn: 370_566, listedBurn: 370_566, listedBurners: 8 }).status).toBe(
      "complete",
    );
    expect(burnCoverage({ verifiedBurn: 100_000, listedBurn: 370_566, listedBurners: 1 }).status).toBe("partial");
    expect(burnCoverage({ tier: "Gold" }).status).toBe("unchecked");
  });
});

describe("unlabeledLedger", () => {
  it("counts only explicitly unlabeled hits", () => {
    expect(
      unlabeledLedger([
        { signature: "a", wallet: "w1", amount: 10, at: 1, labeled: false },
        { signature: "b", wallet: "w2", amount: 5, at: 1 },
      ]),
    ).toEqual({ unlabeledBurned: 10, unlabeledHits: 1 });
  });
});

describe("listedBurnTotal", () => {
  it("sums credited burns and converts to a coverage share", () => {
    expect(listedBurnTotal([{ mint: "a", listedBurn: 100 }, { mint: "b", listedBurn: 50 }])).toBe(150);
    expect(burnVerifiedPct(30, 100)).toBe(0.3);
    expect(burnVerifiedPct(0, 0)).toBeNull();
  });
});

describe("ansemAccuracy", () => {
  it("scores matched $ANSEM and coins within 5% of ansem.io", () => {
    const out = ansemAccuracy([
      { mint: "a", listedBurn: 100, verifiedBurn: 100 },
      { mint: "b", listedBurn: 50, verifiedBurn: 10 },
      { mint: "c", listedBurn: 0, verifiedBurn: 9 },
    ]);
    expect(out.listed).toBe(150);
    expect(out.matched).toBe(110);
    expect(out.pct).toBeCloseTo(110 / 150);
    expect(out.coins).toBe(2);
    expect(out.coinsMatched).toBe(1);
  });
});
