import { describe, expect, it } from "vitest";
import { projectFlags, provenanceLabel, riskScore } from "./flags";
import type { LiveData } from "./types";

function live(partial: Partial<LiveData> = {}): LiveData {
  return {
    priceUsd: null,
    marketCap: null,
    fdv: null,
    airdropMcap: null,
    volume24h: null,
    change24h: null,
    liquidity: null,
    dexUrl: null,
    symbol: "",
    name: "",
    ...partial,
  };
}

const base = {
  walletProvenance: "unknown" as const,
  holderTop10Pct: null as number | null,
  live: live(),
  status: "migrated",
  tier: "Free",
  verifiedBurn: null as number | null,
  burnAmount: 0,
  addedAt: 0,
  launchCount: 0,
};

describe("projectFlags", () => {
  it("warns when listed wallet is not the mint-create wallet", () => {
    const flags = projectFlags({ ...base, walletProvenance: "mismatch" });
    expect(flags).toEqual([{ id: "mismatch", label: "Listed ≠ create", severity: "warn" }]);
  });

  it("flags concentrated holders", () => {
    const warn = projectFlags({ ...base, holderTop10Pct: 0.6 });
    const bad = projectFlags({ ...base, holderTop10Pct: 0.8 });
    expect(warn.find((f) => f.id === "top10")?.severity).toBe("warn");
    expect(bad.find((f) => f.id === "top10")?.severity).toBe("bad");
  });

  it("flags thin liquidity on migrated coins", () => {
    const flags = projectFlags({ ...base, live: live({ liquidity: 400 }) });
    expect(flags.some((f) => f.id === "thinLiq")).toBe(true);
  });

  it("flags a self-reported burn that the chain does not back", () => {
    const flags = projectFlags({ ...base, burnAmount: 100, verifiedBurn: 10 });
    expect(flags.some((f) => f.id === "burnGap")).toBe(true);
  });

  it("flags gold/diamond with no verified burn", () => {
    const flags = projectFlags({ ...base, tier: "Diamond" });
    expect(flags.some((f) => f.id === "unverified")).toBe(true);
  });

  it("does not flag a clean migrated coin", () => {
    expect(
      projectFlags({
        ...base,
        walletProvenance: "matched",
        holderTop10Pct: 0.2,
        live: live({ liquidity: 50_000 }),
        verifiedBurn: 12,
      }),
    ).toEqual([]);
  });

  it("flags bundle/sniper and insider clusters", () => {
    const flags = projectFlags({ ...base, sniper: true, insiderPct: 0.3 });
    expect(flags.some((f) => f.id === "sniper" && f.severity === "bad")).toBe(true);
    expect(flags.find((f) => f.id === "clustered")?.label).toMatch(/Insiders/);
  });

  it("flags serial deployers", () => {
    const warn = projectFlags({ ...base, launchCount: 5 });
    const bad = projectFlags({ ...base, launchCount: 8 });
    expect(warn.find((f) => f.id === "serial")?.severity).toBe("warn");
    expect(bad.find((f) => f.id === "serial")?.label).toBe("8 launches");
  });
});

describe("provenanceLabel", () => {
  it("names the comparison, not a verdict", () => {
    expect(provenanceLabel("matched")).toBe("Same wallet");
    expect(provenanceLabel("mismatch")).toBe("Different wallet");
    expect(provenanceLabel("unknown")).toBe("Not checked");
    expect(provenanceLabel(undefined)).toBe("Not checked");
  });
});

describe("riskScore", () => {
  it("caps at 100", () => {
    expect(riskScore(projectFlags({ ...base, walletProvenance: "mismatch", holderTop10Pct: 0.9, live: live({ liquidity: 100 }), burnAmount: 50, verifiedBurn: 1 }))).toBeLessThanOrEqual(100);
  });
});
