import { describe, expect, it } from "vitest";
import {
  BOOST_EXPIRING_MS,
  burnEvents,
  detectBoostEvents,
  detectLaunches,
  detectMigrations,
  pushHistory,
  pushTape,
  seriesForMint,
  snapshotStatuses,
} from "./tape";

describe("detectLaunches", () => {
  it("does not treat the first snapshot as a flood of launches", () => {
    expect(detectLaunches([], [{ mint: "a", name: "A" }], 1)).toEqual([]);
  });

  it("emits only new mints", () => {
    const events = detectLaunches(["a"], [{ mint: "a", name: "A" }, { mint: "b", name: "B", ticker: "B", slug: "bravo" }], 2);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("launch");
    expect(events[0]?.mint).toBe("b");
    expect(events[0]?.slug).toBe("bravo");
    expect(events[0]?.label).toContain("ansem.io");
  });
});

describe("detectMigrations", () => {
  it("emits when a coin leaves the curve", () => {
    const prev = snapshotStatuses([{ mint: "a", name: "A", status: "on_curve" }]);
    const events = detectMigrations(prev, [{ mint: "a", name: "A", status: "migrated" }], 3);
    expect(events[0]?.kind).toBe("migrate");
  });
});

describe("tape helpers", () => {
  it("dedupes burn signatures and keeps newest first", () => {
    const a = burnEvents([{ signature: "sig1", amount: 10 }], { mint: "m", name: "M" }, 1);
    const b = burnEvents([{ signature: "sig1", amount: 10 }, { signature: "sig2", amount: 2 }], { mint: "m", name: "M" }, 2);
    const tape = pushTape(a, b);
    expect(tape.map((e) => e.id)).toEqual(["burn:sig1", "burn:sig2"]);
  });

  it("tracks rank history per mint including official rank", () => {
    const history = pushHistory([], { at: 1, ranks: { m: 4 }, official: { m: 5 } });
    const next = pushHistory(history, { at: 2, ranks: { m: 2 }, official: { m: 6 } });
    expect(seriesForMint(next, "m")).toEqual([
      { at: 1, rank: 4, officialRank: 5 },
      { at: 2, rank: 2, officialRank: 6 },
    ]);
  });
});

describe("detectBoostEvents", () => {
  const coins = [{ slug: "frog", mint: "m", name: "Frog", ticker: "FROG" }];
  const later = "2026-08-18T12:00:00.000Z";

  it("does not flood on the first snapshot", () => {
    const { events, next } = detectBoostEvents(
      {},
      coins,
      { frog: { amount: 10, expiresAt: later, golden: false } },
      Date.parse("2026-08-18T10:00:00.000Z"),
    );
    expect(events).toEqual([]);
    expect(next.frog?.amount).toBe(10);
  });

  it("emits start, expiring once, then expired", () => {
    const t0 = Date.parse("2026-08-18T10:00:00.000Z");
    const primed = { other: { amount: 1, expiresAt: later } };
    const started = detectBoostEvents(
      primed,
      coins,
      { frog: { amount: 10, expiresAt: later, golden: false } },
      t0,
    );
    expect(started.events.some((e) => e.id.endsWith(":start"))).toBe(true);

    const near = Date.parse(later) - BOOST_EXPIRING_MS / 2;
    const expiring = detectBoostEvents(
      started.next,
      coins,
      { frog: { amount: 10, expiresAt: later, golden: false } },
      near,
    );
    expect(expiring.events.some((e) => e.id.endsWith(":expiring"))).toBe(true);
    const again = detectBoostEvents(
      expiring.next,
      coins,
      { frog: { amount: 10, expiresAt: later, golden: false } },
      near + 1000,
    );
    expect(again.events.some((e) => e.id.endsWith(":expiring"))).toBe(false);

    const ended = detectBoostEvents(expiring.next, coins, {}, Date.parse(later) + 1000);
    expect(ended.events.some((e) => e.id.endsWith(":end"))).toBe(true);
  });
});
