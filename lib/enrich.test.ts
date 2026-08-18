import { describe, expect, it } from "vitest";
import { nextEnrichMints } from "./enrich";

describe("nextEnrichMints", () => {
  it("prefers never-seen then stale", () => {
    const now = 10_000;
    const next = nextEnrichMints(
      ["fresh", "stale", "new"],
      { fresh: { at: now - 100 }, stale: { at: now - 9_000 } },
      1_000,
      2,
      now,
    );
    expect(next).toEqual(["new", "stale"]);
  });
});
