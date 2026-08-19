import { describe, expect, it } from "vitest";
import {
  attributeStrangerBurns,
  candidateMints,
  coinFromText,
  extraBurnForMint,
  independentBurn,
  matchAmountToCoin,
  remainingGaps,
} from "./burn-attr";
import type { LedgerHit } from "./types";

const coins = [
  { mint: "m1", name: "Frog", ticker: "FROG", slug: "frog", launchWallet: "w1", listedBurn: 370_508 },
  { mint: "m2", name: "Toad", ticker: "TOAD", slug: "toad", launchWallet: "w2", listedBurn: 92_627 },
];

describe("coinFromText", () => {
  it("matches mint, unique slug, unique ticker, or json", () => {
    expect(coinFromText("please m1 thanks", coins)?.mint).toBe("m1");
    expect(coinFromText("burn frog now", coins)?.slug).toBe("frog");
    expect(coinFromText('{"slug":"toad"}', coins)?.mint).toBe("m2");
    expect(coinFromText("nope", coins)).toBeNull();
  });
});

describe("matchAmountToCoin", () => {
  it("assigns a unique remaining gap, or fills the sole remaining coin", () => {
    expect(matchAmountToCoin(370_508, [{ mint: "m1", gap: 370_508 }, { mint: "m2", gap: 92_627 }])).toBe("m1");
    expect(matchAmountToCoin(92_627, [{ mint: "m1", gap: 92_627 }, { mint: "m2", gap: 92_627 }])).toBeNull();
    expect(matchAmountToCoin(50_000, [{ mint: "m1", gap: 370_508 }])).toBe("m1");
    expect(matchAmountToCoin(50_000, [{ mint: "m1", gap: 370_508 }, { mint: "m2", gap: 92_627 }])).toBeNull();
  });
});

describe("candidateMints", () => {
  it("lists exact gaps when more than one coin is missing the same amount", () => {
    expect(candidateMints(92_627, [{ mint: "m1", gap: 92_627 }, { mint: "m2", gap: 92_627 }])).toEqual(["m1", "m2"]);
    expect(candidateMints(370_508, [{ mint: "m1", gap: 370_508 }, { mint: "m2", gap: 92_627 }])).toEqual([]);
  });
});

describe("attributeStrangerBurns", () => {
  const hit = (partial: Partial<LedgerHit> & Pick<LedgerHit, "signature">): LedgerHit => ({
    wallet: "stranger",
    amount: 370_508,
    at: 1,
    labeled: false,
    ...partial,
  });

  it("keeps a stranger burn unverified when the amount is not a unique gap", () => {
    const out = attributeStrangerBurns({
      ledger: [hit({ signature: "s1", amount: 10 })],
      attributed: {},
      coins,
      burns: { w1: { verifiedBurn: 0 }, w2: { verifiedBurn: 0 } },
      knownWallets: new Set(["w1", "w2"]),
      projectBurns: { m1: { amount: 370_508, burners: 2 }, m2: { amount: 92_627, burners: 1 } },
    });
    expect(out.ledger[0]?.labeled).toBe(false);
    expect(out.assigned).toHaveLength(0);
  });

  it("records ambiguous exact amounts as candidates, then assigns when only one gap remains", () => {
    const first = attributeStrangerBurns({
      ledger: [hit({ signature: "amb", amount: 92_627 })],
      attributed: {},
      coins,
      burns: { w1: { verifiedBurn: 0 }, w2: { verifiedBurn: 0 } },
      knownWallets: new Set(["w1", "w2"]),
      projectBurns: { m1: { amount: 92_627, burners: 1 }, m2: { amount: 92_627, burners: 1 } },
    });
    expect(first.ledger[0]?.labeled).toBe(false);
    expect(first.ledger[0]?.candidates).toEqual(["m1", "m2"]);
    const second = attributeStrangerBurns({
      ledger: first.ledger,
      attributed: first.attributed,
      coins,
      burns: { w1: { verifiedBurn: 0 }, w2: { verifiedBurn: 92_627 } },
      knownWallets: new Set(["w1", "w2"]),
      projectBurns: { m1: { amount: 92_627, burners: 1 }, m2: { amount: 92_627, burners: 1 } },
    });
    expect(second.ledger[0]).toMatchObject({ mint: "m1", labeled: true, via: "amount" });
    expect(second.ledger[0]?.candidates).toBeUndefined();
  });

  it("fills unlabeled burns into the only remaining credited gap", () => {
    const out = attributeStrangerBurns({
      ledger: [hit({ signature: "part", amount: 10 })],
      attributed: {},
      coins,
      burns: { w1: { verifiedBurn: 0 }, w2: { verifiedBurn: 92_627 } },
      knownWallets: new Set(["w1", "w2"]),
      projectBurns: { m1: { amount: 370_508, burners: 8 }, m2: { amount: 92_627, burners: 1 } },
    });
    expect(out.ledger[0]).toMatchObject({ mint: "m1", labeled: true, via: "amount" });
    expect(extraBurnForMint(out.attributed, "m1")).toBe(10);
  });

  it("assigns a unique missing credited amount", () => {
    const out = attributeStrangerBurns({
      ledger: [hit({ signature: "d1" })],
      attributed: {},
      coins,
      burns: { w1: { verifiedBurn: 0 }, w2: { verifiedBurn: 92_627 } },
      knownWallets: new Set(["w1", "w2"]),
      projectBurns: { m1: { amount: 370_508, burners: 8 }, m2: { amount: 92_627, burners: 1 } },
    });
    expect(out.ledger[0]).toMatchObject({ mint: "m1", labeled: true, via: "amount" });
    expect(extraBurnForMint(out.attributed, "m1")).toBe(370_508);
    expect(out.assigned).toHaveLength(1);
  });

  it("records a mint-hinted stranger without stuffing the launch-wallet cache", () => {
    const out = attributeStrangerBurns({
      ledger: [hit({ signature: "m", amount: 4, mint: "m2", labeled: false, via: "memo" })],
      attributed: {},
      coins,
      burns: {},
      knownWallets: new Set(["w1"]),
      projectBurns: { m2: { amount: 92_627, burners: 2 } },
    });
    expect(out.ledger[0]?.labeled).toBe(true);
    expect(out.attributed.m?.via).toBe("memo");
    expect(independentBurn(null, extraBurnForMint(out.attributed, "m2"))).toBe(4);
  });
});

describe("remainingGaps", () => {
  it("subtracts launch-wallet burns and already-attributed amounts", () => {
    const gaps = remainingGaps(
      coins,
      { w1: { verifiedBurn: 100 } },
      { s: { signature: "s", mint: "m1", amount: 50, via: "mint", wallet: "x", at: 1 } },
      { m1: { amount: 370_508, burners: 2 }, m2: { amount: 92_627, burners: 1 } },
    );
    expect(gaps.find((g) => g.mint === "m1")?.gap).toBe(370_508 - 150);
  });
});
