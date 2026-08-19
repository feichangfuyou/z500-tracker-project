import { describe, expect, it } from "vitest";
import { slimListedCoin, slimRemoteStore } from "./store-slim";
import type { Store } from "./types";

function base(): Store {
  return {
    rev: 1,
    community: [],
    burns: {},
    holders: {},
    addLog: [],
    reports: [],
    provenance: {},
    moderation: [],
    coinSnapshot: { at: 0, coins: [] },
    dex: {},
    scanCursor: { at: 0, scanned: 0, lastWallet: null, errors: 0 },
    rankSnapshot: { at: 0, ranks: {} },
    tape: [],
    rankHistory: [],
    seenMints: [],
    mintStatus: {},
    boostSeen: {},
    watches: { sid: ["mint"] },
    dossiers: {},
    indexDays: [],
    burnLedger: [],
    burnHits: {},
    mintBurnIndex: { cursor: null, headSig: null, exhausted: false, scannedAt: 0, txChecked: 0, txBurned: 0 },
    attributedBurns: {},
    projectBurns: {},
    flagsIssued: [],
    webhookAt: null,
  };
}

describe("slimListedCoin", () => {
  it("drops ansem.io extras like description so the snapshot stays small", () => {
    const slim = slimListedCoin({
      mint: "Mint111111111111111111111111111111111111111",
      slug: "frog",
      name: "Frog",
      ticker: "FROG",
      tier: "gold",
      description: "x".repeat(4000),
      creatorWallet: "Creator11111111111111111111111111111111111",
    });
    expect(slim?.creatorWallet).toMatch(/^Creator/);
    expect(slim && "description" in slim).toBe(false);
  });

  it("drops rows without a mint", () => {
    expect(slimListedCoin({ name: "nope" })).toBeNull();
  });
});

describe("slimRemoteStore", () => {
  it("caps rank history and strips watches so the blob can save", () => {
    const store = base();
    store.rankHistory = Array.from({ length: 72 }, (_, i) => ({
      at: i + 1,
      ranks: { a: i, b: i + 1 },
      official: { a: i, b: i + 1 },
    }));
    const slim = slimRemoteStore(store);
    expect(slim.rankHistory).toHaveLength(18);
    expect(slim.watches).toEqual({});
  });
});
