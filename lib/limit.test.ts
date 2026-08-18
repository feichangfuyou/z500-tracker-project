import { describe, expect, it } from "vitest";
import { resetLimits, tooMany } from "./limit";

describe("tooMany", () => {
  it("allows bursts under the max, then blocks", () => {
    resetLimits();
    expect(tooMany("t", 3, 1_000, 10_000)).toBe(false);
    expect(tooMany("t", 3, 1_000, 10_010)).toBe(false);
    expect(tooMany("t", 3, 1_000, 10_020)).toBe(false);
    expect(tooMany("t", 3, 1_000, 10_030)).toBe(true);
  });

  it("expires hits outside the window", () => {
    resetLimits();
    expect(tooMany("u", 1, 100, 1_000)).toBe(false);
    expect(tooMany("u", 1, 100, 1_050)).toBe(true);
    expect(tooMany("u", 1, 100, 1_200)).toBe(false);
  });
});
