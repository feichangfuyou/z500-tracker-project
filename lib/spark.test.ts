import { describe, expect, it } from "vitest";
import { rankToY, seriesPoints, sparkPath } from "./spark";

describe("spark helpers", () => {
  it("puts rank 1 at the top of the chart", () => {
    expect(rankToY(1, 1, 10, 100, 0)).toBe(0);
    expect(rankToY(10, 1, 10, 100, 0)).toBe(100);
  });

  it("skips missing official points", () => {
    const pts = seriesPoints([4, null, 2], 100, 50, 0, 1, 4);
    expect(pts).toHaveLength(2);
    expect(sparkPath(pts).startsWith("M")).toBe(true);
  });
});
