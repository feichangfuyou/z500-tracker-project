import { describe, expect, it } from "vitest";
import { TOKEN_PROGRAM } from "./programs";
import { provenanceCacheForEnrich, provenanceFromStore, provenanceStatus } from "./provenance";

describe("provenanceStatus", () => {
  it("does not flag token-program parses as listed ≠ create", () => {
    expect(provenanceStatus("Listed111", TOKEN_PROGRAM, "Listed111")).toBe("matched");
    expect(provenanceFromStore("Listed111", { onchainCreator: TOKEN_PROGRAM, pumpCreator: "Listed111", createSig: "sig" }, {
      creator: TOKEN_PROGRAM,
    })).toBe("matched");
    expect(provenanceFromStore("Listed111", { onchainCreator: "Other111", pumpCreator: "Listed111", createSig: null }, {
      creator: "Other111",
    })).toBe("matched");
  });
});

describe("provenanceCacheForEnrich", () => {
  it("treats a program-id creator as immediately stale", () => {
    const cache = provenanceCacheForEnrich({
      good: { creator: "Wallet111", at: 9_000 },
      bad: { creator: TOKEN_PROGRAM, at: 9_000 },
    });
    expect(cache.good?.at).toBe(9_000);
    expect(cache.bad?.at).toBe(0);
  });
});
