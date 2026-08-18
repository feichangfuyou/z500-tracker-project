import { describe, expect, it } from "vitest";
import { applyBurnValue, burnAnnounce, burnIncreases, snapshotBurns } from "./burn-fx";

describe("snapshotBurns", () => {
  it("records verified amounts, treating null as 0", () => {
    expect(snapshotBurns([{ id: "a", verifiedBurn: 3 }, { id: "b", verifiedBurn: null }])).toEqual({
      a: 3,
      b: 0,
    });
  });
});

describe("burnIncreases", () => {
  it("ignores first sight of a coin even if it already has burns", () => {
    const { hits, next } = burnIncreases({}, [{ id: "a", name: "OINK", verifiedBurn: 40 }]);
    expect(hits).toEqual([]);
    expect(next).toEqual({ a: 40 });
  });

  it("emits a hit when a known coin's verified burn rises", () => {
    const { hits } = burnIncreases({ a: 10 }, [{ id: "a", name: "OINK", verifiedBurn: 25 }]);
    expect(hits).toEqual([{ id: "a", name: "OINK", delta: 15 }]);
  });

  it("stays quiet when the amount is unchanged", () => {
    const { hits } = burnIncreases({ a: 10 }, [{ id: "a", name: "OINK", verifiedBurn: 10 }]);
    expect(hits).toEqual([]);
  });
});

describe("applyBurnValue", () => {
  it("ignites when verify finds a larger amount", () => {
    const { hit, next } = applyBurnValue({ a: 2 }, "a", 9, "OINK");
    expect(hit).toEqual({ id: "a", name: "OINK", delta: 7 });
    expect(next.a).toBe(9);
  });

  it("does not ignite on a first verify of zero", () => {
    const { hit } = applyBurnValue({}, "a", 0, "OINK");
    expect(hit).toBeNull();
  });
});

describe("burnAnnounce", () => {
  it("names the coin and the newly burned amount", () => {
    expect(burnAnnounce({ id: "a", name: "OINK", delta: 12.5 })).toBe("12.5 $ANSEM burned on OINK");
  });
});
