import { describe, expect, it } from "vitest";
import { cronAuthorized } from "./cron-auth";
import { activeBoost } from "./ansem";
import { officialDelta, officialScore } from "./score";

describe("activeBoost", () => {
  it("drops expired or empty boosts", () => {
    expect(activeBoost({ amount: 10, expiresAt: "2020-01-01T00:00:00.000Z", golden: false }, Date.parse("2026-01-01"))).toBeNull();
    expect(activeBoost({ amount: 0, expiresAt: "2030-01-01T00:00:00.000Z", golden: false })).toBeNull();
    expect(activeBoost({ amount: 10, expiresAt: "2030-01-01T00:00:00.000Z", golden: true })?.golden).toBe(true);
  });
});

describe("officialScore", () => {
  it("uses listed airdrop mcap plus boosts, ignoring burns", () => {
    expect(officialScore({ listedAirdropMcap: 1000, boostPoints: 10 })).toBe(600 + 2500);
  });
});

describe("officialDelta", () => {
  it("is positive when Crosscheck ranks a coin higher", () => {
    expect(officialDelta(8, 3)).toBe(5);
    expect(officialDelta(2, 6)).toBe(-4);
    expect(officialDelta(null, 1)).toBeNull();
  });
});

describe("cronAuthorized", () => {
  it("requires the bearer secret when CRON_SECRET is set", () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "s3cret";
    try {
      expect(cronAuthorized(new Request("http://localhost/api/cron/scan"))).toBe(false);
      expect(
        cronAuthorized(
          new Request("http://localhost/api/cron/scan", { headers: { authorization: "Bearer s3cret" } }),
        ),
      ).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  it("rejects a missing bearer even with the local default key", () => {
    const prev = process.env.CRON_SECRET;
    const vercel = process.env.VERCEL;
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
    try {
      expect(cronAuthorized(new Request("http://localhost/api/cron/scan"))).toBe(false);
      expect(
        cronAuthorized(
          new Request("http://localhost/api/cron/scan", { headers: { authorization: "Bearer dev-cron" } }),
        ),
      ).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
      if (vercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = vercel;
    }
  });
});
