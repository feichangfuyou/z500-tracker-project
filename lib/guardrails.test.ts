import { describe, expect, it } from "vitest";
import {
  addHits,
  isDuplicateMint,
  isValidAddress,
  matchLaunchWallet,
  overAddLimit,
  pruneAddLog,
  shouldHideFromReports,
} from "./guardrails";

describe("isValidAddress", () => {
  it("accepts a pump mint", () => {
    expect(isValidAddress("9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isValidAddress("not-a-mint")).toBe(false);
    expect(isValidAddress("")).toBe(false);
  });
});

describe("rate limit", () => {
  it("counts sid or ip in the window", () => {
    const now = 1_000_000;
    const log = pruneAddLog(
      [
        { sid: "a", ip: "1.1.1.1", at: now - 1000 },
        { sid: "b", ip: "1.1.1.1", at: now - 2000 },
        { sid: "a", ip: "9.9.9.9", at: now - 60 * 60 * 1000 - 1 },
      ],
      now,
    );
    expect(log).toHaveLength(2);
    expect(addHits(log, "a", "1.1.1.1")).toBe(2);
    expect(overAddLimit(5)).toBe(true);
    expect(overAddLimit(4)).toBe(false);
  });
});

describe("duplicates and reports", () => {
  it("flags duplicate mints", () => {
    expect(isDuplicateMint(["abc"], "abc")).toBe(true);
    expect(isDuplicateMint(["abc"], "xyz")).toBe(false);
  });
  it("hides at 3 reports", () => {
    expect(shouldHideFromReports(2)).toBe(false);
    expect(shouldHideFromReports(3)).toBe(true);
  });
});

describe("wallet provenance", () => {
  it("matches identical wallets", () => {
    expect(matchLaunchWallet("Aaa", "Aaa")).toBe("matched");
    expect(matchLaunchWallet("Aaa", "Bbb")).toBe("mismatch");
    expect(matchLaunchWallet("Aaa", null)).toBe("unknown");
  });
  it("does not call pump-only disagreement a mismatch", () => {
    expect(matchLaunchWallet("Aaa", null, "Aaa")).toBe("matched");
    expect(matchLaunchWallet("Aaa", null, "Bbb")).toBe("unknown");
    expect(matchLaunchWallet("Aaa", "Bbb", "Aaa")).toBe("mismatch");
  });
});
