import { describe, expect, it } from "vitest";
import { radarFromRugcheck } from "./radar";

describe("radarFromRugcheck", () => {
  it("sums insider holders and flags sniper risks", () => {
    const radar = radarFromRugcheck({
      graphInsidersDetected: 0,
      risks: [{ name: "Pump bundled buys" }],
      topHolders: [
        { address: "A".repeat(32), pct: 40, insider: true },
        { address: "B".repeat(32), pct: 20, insider: false },
        { address: "C".repeat(32), pct: 10, insider: true },
      ],
    });
    expect(radar.top10Pct).toBeCloseTo(0.7);
    expect(radar.insiderPct).toBeCloseTo(0.5);
    expect(radar.sniper).toBe(true);
    expect(radar.clustered).toBe(true);
    expect(radar.holders).toHaveLength(3);
  });

  it("treats empty reports as clean", () => {
    expect(radarFromRugcheck({ topHolders: [{ pct: 8, insider: false }] })).toEqual({
      top10Pct: 0.08,
      insiderPct: null,
      sniper: false,
      clustered: false,
      holders: [],
    });
  });
});
