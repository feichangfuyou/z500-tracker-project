import { describe, expect, it } from "vitest";
import { mergeWatches, parseWatchList, sameWatchList } from "./watch";

describe("watch lists", () => {
  it("merges and caps unique mints", () => {
    const a = "A".repeat(32);
    const b = "B".repeat(32);
    expect(mergeWatches([a, a], [b, "nope"])).toEqual([a, b]);
  });

  it("compares watch lists as sets", () => {
    const a = "A".repeat(32);
    const b = "B".repeat(32);
    expect(sameWatchList([a, b], [b, a])).toBe(true);
    expect(sameWatchList([a], [a, b])).toBe(false);
  });

  it("compares watch lists as sets", () => {
    const a = "A".repeat(32);
    const b = "B".repeat(32);
    expect(sameWatchList([a, b], [b, a])).toBe(true);
    expect(sameWatchList([a], [a, b])).toBe(false);
  });

  it("drops junk", () => {
    expect(parseWatchList([1, null, "short"])).toEqual([]);
  });
});
