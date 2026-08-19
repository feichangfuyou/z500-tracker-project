import { describe, expect, it } from "vitest";
import {
  FLAG_LEDGER_MAX,
  FLAG_RESOLVE_MS,
  flagFromTape,
  flagStats,
  flagsForMint,
  flagsForWallet,
  issueFlags,
  parseFlagLedger,
  publicFlag,
  trimFlagLedger,
} from "./flag-ledger";
import { detectSerialFlags, pushTape } from "./tape";
import type { FlagIssued, TapeEvent } from "./types";

function serialCoins(count: number, wallet = "w") {
  return Array.from({ length: count }, (_, i) => ({
    mint: String.fromCharCode(97 + i),
    name: String.fromCharCode(65 + i),
    ticker: String.fromCharCode(65 + i),
    wallet,
    slug: `coin-${i}`,
  }));
}

function issued(partial: Partial<FlagIssued> & Pick<FlagIssued, "id" | "wallet" | "mint">): FlagIssued {
  return {
    name: partial.name || partial.mint,
    flagType: "serial",
    threshold: 5,
    launchCount: 5,
    issuedAt: 1,
    resolutionDueAt: 1 + FLAG_RESOLVE_MS,
    outcome: null,
    outcomeResolvedAt: null,
    ...partial,
  };
}

describe("flagFromTape", () => {
  it("turns a serial crossing into a ledger row", () => {
    const events = detectSerialFlags(["a", "b", "c", "d"], serialCoins(5), 10);
    expect(events).toHaveLength(1);
    const row = flagFromTape(events[0]!, 10);
    expect(row).toMatchObject({
      wallet: "w",
      mint: "e",
      flagType: "serial",
      threshold: 5,
      launchCount: 5,
      issuedAt: 10,
      outcome: null,
    });
    expect(row?.id).toBe("flag:serial:w:5");
    expect(row?.resolutionDueAt).toBe(10 + FLAG_RESOLVE_MS);
  });

  it("ignores burns and launches", () => {
    expect(flagFromTape({ id: "launch:m:1", kind: "launch", at: 1, mint: "m", name: "M", label: "x" })).toBeNull();
    expect(flagFromTape({ id: "burn:sig", kind: "burn", at: 1, mint: "m", name: "M", label: "x" })).toBeNull();
  });
});

describe("issueFlags", () => {
  it("keeps the first issuedAt when the same flag fires again", () => {
    const events = detectSerialFlags(["a", "b", "c", "d"], serialCoins(5), 10);
    const first = issueFlags([], events, 10);
    const again = events.map((event) => ({ ...event, at: 99 }));
    const next = issueFlags(first, again, 99);
    expect(next).toHaveLength(1);
    expect(next[0]?.issuedAt).toBe(10);
  });

  it("survives the tape rolling off", () => {
    const flags = detectSerialFlags(["a", "b", "c", "d"], serialCoins(5), 2);
    const burns: TapeEvent[] = Array.from({ length: 12 }, (_, i) => ({
      id: `burn:${i}`,
      kind: "burn",
      at: 3 + i,
      mint: "z",
      name: "Z",
      label: "burn",
    }));
    const tape = pushTape(pushTape([], flags, 8), burns, 8);
    expect(tape.some((event) => event.kind === "flag")).toBe(false);
    const ledger = issueFlags([], flags, 2);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.wallet).toBe("w");
  });

  it("records the 8th launch as a second row", () => {
    const five = detectSerialFlags(["a", "b", "c", "d"], serialCoins(5), 2);
    const eight = detectSerialFlags(
      ["a", "b", "c", "d", "e", "f", "g"],
      serialCoins(8),
      3,
    );
    const ledger = issueFlags(issueFlags([], five, 2), eight, 3);
    expect(ledger.map((row) => row.threshold).sort((a, b) => a - b)).toEqual([5, 8]);
  });
});

describe("flag lookups", () => {
  it("filters by wallet and mint", () => {
    const ledger = [
      issued({ id: "flag:serial:w1:5", wallet: "w1", mint: "a", issuedAt: 2 }),
      issued({ id: "flag:serial:w2:5", wallet: "w2", mint: "b", issuedAt: 1 }),
    ];
    expect(flagsForWallet(ledger, "w1").map((row) => row.mint)).toEqual(["a"]);
    expect(flagsForMint(ledger, "b").map((row) => row.wallet)).toEqual(["w2"]);
    expect(flagsForWallet([], "w1")).toEqual([]);
  });

  it("counts open vs due vs resolved without inventing accuracy", () => {
    const now = 20;
    const stats = flagStats(
      [
        issued({ id: "a", wallet: "w", mint: "a", issuedAt: 1, resolutionDueAt: 10 }),
        issued({ id: "b", wallet: "w", mint: "b", issuedAt: 19, resolutionDueAt: 100 }),
        issued({ id: "c", wallet: "w", mint: "c", issuedAt: 1, outcome: "held", outcomeResolvedAt: 5 }),
      ],
      now,
    );
    expect(stats).toEqual({ issued: 3, open: 2, due: 1, resolved: 1 });
    expect("accuracy" in stats).toBe(false);
  });
});

describe("parseFlagLedger", () => {
  it("drops garbage and keeps a valid row", () => {
    const parsed = parseFlagLedger([
      { id: "flag:serial:w:5", wallet: "w", mint: "m", name: "M", issuedAt: 9, threshold: 5, launchCount: 5 },
      { id: "nope" },
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.wallet).toBe("w");
    expect(publicFlag(parsed[0]!).outcome).toBeNull();
  });
});

describe("trimFlagLedger", () => {
  it("drops oldest resolved rows before open ones", () => {
    const rows = [
      issued({ id: "open", wallet: "w", mint: "a", issuedAt: 1 }),
      issued({ id: "old", wallet: "w", mint: "b", issuedAt: 2, outcome: "held", outcomeResolvedAt: 3 }),
      issued({ id: "newer", wallet: "w", mint: "c", issuedAt: 4, outcome: "held", outcomeResolvedAt: 5 }),
    ];
    const trimmed = trimFlagLedger(rows, 2);
    expect(trimmed.map((row) => row.id)).toEqual(["newer", "open"]);
  });

  it("caps the ledger", () => {
    expect(FLAG_LEDGER_MAX).toBe(400);
    const rows = Array.from({ length: 12 }, (_, i) =>
      issued({ id: `f${i}`, wallet: "w", mint: `m${i}`, issuedAt: i }),
    );
    expect(trimFlagLedger(rows, 10)).toHaveLength(10);
  });
});
