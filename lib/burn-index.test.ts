import { describe, expect, it } from "vitest";
import { ledgerFromHits, pruneBurnHits, seedBurnHits, upsertBurnHits } from "./burn-index";
import type { LedgerHit } from "./types";

function hit(partial: Partial<LedgerHit> & Pick<LedgerHit, "signature">): LedgerHit {
  return { wallet: "w", amount: 10, at: 1, labeled: true, ...partial };
}

describe("upsertBurnHits", () => {
  it("keeps the first signature and upgrades unlabeled to labeled", () => {
    const first = upsertBurnHits({}, [hit({ signature: "s1", labeled: false, amount: 10, at: 1 })]);
    expect(first.fresh).toHaveLength(1);
    const again = upsertBurnHits(first.hits, [hit({ signature: "s1", labeled: true, mint: "m1", via: "amount", at: 9 })]);
    expect(again.fresh).toHaveLength(0);
    expect(again.hits.s1).toMatchObject({ labeled: true, mint: "m1", via: "amount", amount: 10 });
  });
});

describe("pruneBurnHits", () => {
  it("keeps unlabeled rows ahead of labeled ones when over cap", () => {
    const hits = pruneBurnHits(
      {
        a: hit({ signature: "a", labeled: true, at: 9 }),
        b: hit({ signature: "b", labeled: false, at: 1 }),
        c: hit({ signature: "c", labeled: true, at: 8 }),
      },
      2,
    );
    expect(Object.keys(hits).sort()).toEqual(["a", "b"]);
  });
});

describe("ledgerFromHits", () => {
  it("surfaces unlabeled first", () => {
    const ledger = ledgerFromHits({
      a: hit({ signature: "a", labeled: true, at: 9 }),
      b: hit({ signature: "b", labeled: false, at: 1 }),
    });
    expect(ledger.map((h) => h.signature)).toEqual(["b", "a"]);
  });
});

describe("seedBurnHits", () => {
  it("rebuilds from the rolling tape when the durable map is empty", () => {
    const seeded = seedBurnHits({}, [hit({ signature: "old" })]);
    expect(seeded.old?.amount).toBe(10);
    expect(seedBurnHits({ keep: hit({ signature: "keep" }) }, [hit({ signature: "old" })]).old).toBeUndefined();
  });
});
