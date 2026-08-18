import { describe, expect, it } from "vitest";
import { airdropLedger, holdingsTotal, matchHoldings } from "./airdrop";

describe("matchHoldings", () => {
  it("keeps only board mints and sorts by value", () => {
    const rows = matchHoldings(
      [
        { mint: "a", amount: 10 },
        { mint: "b", amount: 5 },
        { mint: "z", amount: 99 },
      ],
      [
        { mint: "a", name: "Alpha", ticker: "A", priceUsd: 2, slug: "alpha" },
        { mint: "b", name: "Bravo", ticker: "B", priceUsd: 10, slug: "bravo" },
      ],
    );
    expect(rows.map((r) => r.mint)).toEqual(["b", "a"]);
    expect(rows[0]?.slug).toBe("bravo");
    expect(rows.every((r) => r.status === "in_wallet")).toBe(true);
    expect(holdingsTotal(rows)).toBe(70);
  });

  it("drops zero balances", () => {
    expect(matchHoldings([{ mint: "a", amount: 0 }], [{ mint: "a", name: "A", priceUsd: 1 }])).toEqual([]);
  });
});

describe("airdropLedger", () => {
  const coins = [
    { mint: "a", name: "Alpha", ticker: "A", priceUsd: 2, airdropTotal: 100 },
    { mint: "b", name: "Bravo", ticker: "B", priceUsd: 3, airdropTotal: 50 },
  ];

  it("splits held airdrops from coins not in the wallet", () => {
    const ledger = airdropLedger(
      [
        { mint: "ANSEM", amount: 12 },
        { mint: "a", amount: 4 },
      ],
      coins,
      "ANSEM",
    );
    expect(ledger.holdsAnsem).toBe(true);
    expect(ledger.claimed.map((r) => r.mint)).toEqual(["a"]);
    expect(ledger.missing.map((r) => r.mint)).toEqual(["b"]);
    expect(ledger.totalUsd).toBe(8);
  });

  it("does not treat $ANSEM itself as an airdrop row", () => {
    const ledger = airdropLedger([{ mint: "ANSEM", amount: 1 }], coins, "ANSEM");
    expect(ledger.claimed).toEqual([]);
    expect(ledger.ansemAmount).toBe(1);
  });

  it("hides the missing list when the wallet holds no $ANSEM", () => {
    const ledger = airdropLedger([{ mint: "a", amount: 1 }], coins, "ANSEM");
    expect(ledger.holdsAnsem).toBe(false);
    expect(ledger.missing).toEqual([]);
    expect(ledger.claimed.map((r) => r.mint)).toEqual(["a"]);
  });

  it("splits still-claimable from claimed-then-sold", () => {
    const ledger = airdropLedger(
      [
        { mint: "ANSEM", amount: 1 },
        { mint: "a", amount: 4 },
        { mint: "b", amount: 0 },
      ],
      coins,
      "ANSEM",
    );
    expect(ledger.claimed.map((r) => r.mint)).toEqual(["a"]);
    expect(ledger.sold.map((r) => r.mint)).toEqual(["b"]);
    expect(ledger.claimable).toEqual([]);
  });

  it("treats airdropped coins with no token account as claimable", () => {
    const ledger = airdropLedger([{ mint: "ANSEM", amount: 1 }], coins, "ANSEM");
    expect(ledger.claimable.map((r) => r.mint)).toEqual(["a", "b"]);
    expect(ledger.sold).toEqual([]);
  });
});
