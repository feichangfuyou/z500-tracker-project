import { describe, expect, it } from "vitest";
import { fmtAge, fmtDrop, fmtHead, fmtInt, fmtUsd } from "./format";

describe("fmtHead", () => {
  it("matches ansem.io compact (1 decimal B/M/K)", () => {
    expect(fmtHead(2_325_003_984.2873874)).toBe("2.3B");
    expect(fmtHead(29_413)).toBe("29.4K");
    expect(fmtHead(1_493_480)).toBe("1.5M");
    expect(fmtHead(43)).toBe("43");
  });
});

describe("fmtDrop", () => {
  it("matches z500 airdrop cells", () => {
    expect(fmtDrop(424_999_999.97)).toBe("~425.0M");
    expect(fmtDrop(0)).toBe("—");
    expect(fmtDrop(null)).toBe("—");
  });
});

describe("fmtAge", () => {
  it("matches z500 age cells", () => {
    const now = Date.parse("2026-08-19T12:00:00Z");
    expect(fmtAge(Date.parse("2026-08-19T11:40:00Z"), now)).toBe("20m");
    expect(fmtAge(Date.parse("2026-08-17T12:38:00Z"), now)).toBe("47h 22m");
    expect(fmtAge(Date.parse("2026-08-16T12:00:00Z"), now)).toBe("3d 0h");
  });
});

describe("listed headline usd", () => {
  it("prints ATH airdrop dollars the way ansem.io does", () => {
    expect(fmtUsd(615_679.577)).toBe("$615.7K");
    expect(Math.round(1_493_480.779595).toLocaleString()).toBe(fmtInt(1_493_480.779595));
  });
});
