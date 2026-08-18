import { describe, expect, it } from "vitest";
import { mergeWatches, parseWatchList } from "./watch";

describe("watch lists", () => {
  it("merges and caps unique mints", () => {
    const a = "A".repeat(32);
    const b = "B".repeat(32);
    expect(mergeWatches([a, a], [b, "nope"])).toEqual([a, b]);
  });

  it("drops junk", () => {
    expect(parseWatchList([1, null, "short"])).toEqual([]);
  });
});
