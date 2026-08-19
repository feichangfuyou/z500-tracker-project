import { describe, expect, it } from "vitest";
import {
  applyWalletScan,
  applyWebhookHit,
  ingestWalletScan,
  ingestWebhookHits,
  ledgerForMint,
  mergeLedger,
  namedLaunchForWallet,
  type BurnScan,
} from "./burn-ledger";
import type { BurnCache, LedgerHit } from "./types";

const hit = (partial: Partial<LedgerHit> & Pick<LedgerHit, "signature">): LedgerHit => ({
  wallet: "w1",
  amount: 10,
  at: 1,
  mint: "m1",
  ...partial,
});

function cache(partial: Partial<BurnCache> = {}): BurnCache {
  return {
    wallet: "w1",
    verifiedBurn: 100,
    txChecked: 40,
    txBurned: 2,
    scannedAt: 1,
    cursor: "c",
    exhausted: true,
    headSig: "h",
    indexedBy: "helius",
    ...partial,
  };
}

function scan(partial: Partial<BurnScan> = {}): BurnScan {
  return {
    verifiedBurn: 10,
    txChecked: 5,
    txBurned: 1,
    cursor: "c2",
    exhausted: false,
    headSig: "h2",
    events: [{ signature: "s1", amount: 10 }],
    indexedBy: "helius",
    ...partial,
  };
}

describe("mergeLedger", () => {
  it("appends new signatures and skips dupes", () => {
    const first = mergeLedger([], [hit({ signature: "s1" }), hit({ signature: "s1", amount: 99 })]);
    expect(first.fresh).toHaveLength(1);
    const second = mergeLedger(first.ledger, [hit({ signature: "s1" }), hit({ signature: "s2", amount: 3 })]);
    expect(second.fresh.map((h) => h.signature)).toEqual(["s2"]);
    expect(second.ledger.map((h) => h.signature)).toEqual(["s2", "s1"]);
    const skipped = mergeLedger([], [hit({ signature: "s1" })], 300, ["s1"]);
    expect(skipped.fresh).toHaveLength(0);
  });
});

describe("applyWalletScan", () => {
  it("adds only fresh webhook-duped amounts on a head pass", () => {
    const next = applyWalletScan(cache(), scan(), []);
    expect(next.verifiedBurn).toBe(100);
    expect(next.txBurned).toBe(2);
    expect(next.txChecked).toBe(45);
  });

  it("adds fresh event amounts instead of the raw page sum", () => {
    const next = applyWalletScan(cache(), scan({ verifiedBurn: 25, txBurned: 2 }), [hit({ signature: "s1", amount: 10 })]);
    expect(next.verifiedBurn).toBe(110);
    expect(next.txBurned).toBe(3);
  });

  it("replaces on reindex and keeps previous totals when a replace scan is empty", () => {
    expect(applyWalletScan(cache(), scan({ replace: true, verifiedBurn: 80, events: [] }), []).verifiedBurn).toBe(80);
    expect(
      applyWalletScan(cache(), scan({ replace: true, verifiedBurn: 0, txChecked: 0, events: [] }), []).verifiedBurn,
    ).toBe(100);
  });
});

describe("applyWebhookHit", () => {
  it("increments a known wallet without marking it exhausted", () => {
    const next = applyWebhookHit(cache({ exhausted: false }), hit({ signature: "live", amount: 7 }), 9);
    expect(next.verifiedBurn).toBe(107);
    expect(next.txBurned).toBe(3);
    expect(next.exhausted).toBe(false);
    expect(next.indexedBy).toBe("helius");
    expect(next.scannedAt).toBe(9);
  });
});

describe("ingestWalletScan", () => {
  it("writes ledger, cache, and tape for a new signature", () => {
    const out = ingestWalletScan({
      wallet: "w1",
      scan: scan(),
      burns: {},
      ledger: [],
      tape: [],
      named: { mint: "m1", name: "Frog", ticker: "FROG" },
      now: 4,
    });
    expect(out.cache.verifiedBurn).toBe(10);
    expect(out.fresh).toHaveLength(1);
    expect(out.events[0]?.id).toBe("burn:s1");
    expect(out.ledger[0]?.mint).toBe("m1");
  });

  it("does not double a Diamond burn when the same signatures come back", () => {
    const first = ingestWalletScan({
      wallet: "w1",
      scan: scan({ verifiedBurn: 370508, events: [{ signature: "d1", amount: 370508 }] }),
      burns: {},
      ledger: [],
      tape: [],
      named: { mint: "m1", name: "Z", ticker: "Z" },
    });
    const second = ingestWalletScan({
      wallet: "w1",
      scan: scan({ verifiedBurn: 370508, events: [{ signature: "d1", amount: 370508 }] }),
      burns: first.burns,
      ledger: first.ledger,
      tape: first.tape,
      named: { mint: "m1", name: "Z", ticker: "Z" },
    });
    expect(second.cache.verifiedBurn).toBe(370508);
    expect(second.fresh).toHaveLength(0);
  });
});

describe("ingestWebhookHits", () => {
  it("keeps unlabeled wallets on the ledger without stuffing them into the launch-wallet cache", () => {
    const out = ingestWebhookHits({
      hits: [
        { signature: "live", wallet: "w1", amount: 7, at: 9 },
        { signature: "noise", wallet: "stranger", amount: 99, at: 9 },
        { signature: "hint", wallet: "stranger2", amount: 4, at: 9, mint: "m9" },
      ],
      burns: {},
      ledger: [],
      tape: [],
      knownWallets: new Set(["w1"]),
      namedFor: (wallet) => (wallet === "w1" ? { mint: "m1", name: "Frog", ticker: "FROG" } : null),
      now: 9,
    });
    expect(out.fresh).toHaveLength(3);
    expect(out.burns.w1?.verifiedBurn).toBe(7);
    expect(out.burns.stranger).toBeUndefined();
    expect(out.ledger.find((h) => h.wallet === "stranger")?.labeled).toBe(false);
    expect(out.ledger.find((h) => h.wallet === "stranger2")?.labeled).toBe(true);
    expect(out.ledger.find((h) => h.wallet === "stranger2")?.via).toBe("mint");
    expect(out.events[0]?.id).toBe("burn:live");
    expect(out.events.some((e) => e.id === "burn:hint")).toBe(true);
  });
});

describe("namedLaunchForWallet", () => {
  it("prefers the listed coin then community", () => {
    expect(
      namedLaunchForWallet("w1", [{ mint: "m1", name: "Frog", ticker: "FROG", creatorWallet: "w1", slug: "frog" }])?.slug,
    ).toBe("frog");
    expect(namedLaunchForWallet("w2", [], [{ mint: "m2", name: "Com", launchWallet: "w2" }])?.name).toBe("Com");
    expect(namedLaunchForWallet("missing", [], [])).toBeNull();
  });
});

describe("ledgerForMint", () => {
  it("matches mint, launch wallet, or an ambiguous candidate", () => {
    const ledger = [
      hit({ signature: "a", mint: "m1" }),
      hit({ signature: "b", mint: undefined, wallet: "w1" }),
      hit({ signature: "c", mint: undefined, wallet: "stranger", labeled: false, candidates: ["m1", "m2"] }),
    ];
    expect(ledgerForMint(ledger, "m1", "w1").map((h) => h.signature)).toEqual(["a", "b", "c"]);
  });
});
