import { describe, expect, it } from "vitest";
import { FLAG_RESOLVE_MS } from "./flag-ledger";
import { flagCloseStats, resolveDueFlags, serialOutcome } from "./flag-resolve";
import { LIQ_THIN } from "./flags";
import type { FlagIssued } from "./types";

function flag(partial: Partial<FlagIssued> = {}): FlagIssued {
  return {
    id: "flag:serial:w:5",
    wallet: "w",
    mint: "m1",
    name: "Frog",
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

describe("serialOutcome", () => {
  it("closes as a rug when liquidity is gone, and held when the pool is still thick", () => {
    expect(serialOutcome({ mint: "m", onBoard: true, liquidity: 50 })).toBe("confirmed_rug");
    expect(serialOutcome({ mint: "m", onBoard: true, liquidity: LIQ_THIN })).toBe("held");
    expect(serialOutcome({ mint: "m", onBoard: true, liquidity: 800 })).toBeNull();
    expect(serialOutcome(undefined)).toBeNull();
  });
});

describe("resolveDueFlags", () => {
  it("leaves open flags alone until the due date, then writes an outcome once", () => {
    const due = 1 + FLAG_RESOLVE_MS;
    const open = resolveDueFlags([flag()], { m1: { mint: "m1", onBoard: true, liquidity: LIQ_THIN } }, due - 1);
    expect(open[0]?.outcome).toBeNull();
    const closed = resolveDueFlags(open, { m1: { mint: "m1", onBoard: true, liquidity: LIQ_THIN } }, due);
    expect(closed[0]?.outcome).toBe("held");
    const again = resolveDueFlags(closed, { m1: { mint: "m1", onBoard: true, liquidity: 0 } }, due + 10);
    expect(again[0]?.outcome).toBe("held");
  });
});

describe("flagCloseStats", () => {
  it("omits rugRate until a flag closes, then uses confirmed_rug ÷ closed", () => {
    expect(flagCloseStats([flag()]).rugRate).toBeNull();
    const stats = flagCloseStats([
      flag({ id: "a", outcome: "confirmed_rug", outcomeResolvedAt: 2 }),
      flag({ id: "b", mint: "m2", outcome: "held", outcomeResolvedAt: 2 }),
    ]);
    expect(stats.resolved).toBe(2);
    expect(stats.confirmedRug).toBe(1);
    expect(stats.held).toBe(1);
    expect(stats.rugRate).toBe(0.5);
    expect("accuracy" in stats).toBe(false);
  });
});
