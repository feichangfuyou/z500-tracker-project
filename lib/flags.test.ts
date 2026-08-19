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
  mint: "Mint111111111111111111111111111111111111111",
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
  it("does not treat a listed burn wallet as a warning", () => {
    expect(projectFlags({ ...base, walletProvenance: "mismatch" })).toEqual([]);
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

  it("flags credited burns from unlabeled wallets instead of treating listed as complete", () => {
    const flags = projectFlags({ ...base, tier: "Diamond", verifiedBurn: 0, listedBurn: 370_566, listedBurners: 4 });
    expect(flags.find((f) => f.id === "unverified")?.label).toMatch(/unlabeled/i);
  });

  it("does not flag credited burns we independently filled in", () => {
    const flags = projectFlags({
      ...base,
      tier: "Diamond",
      verifiedBurn: 370_566,
      listedBurn: 370_566,
      listedBurners: 8,
    });
    expect(flags.find((f) => f.id === "unverified")).toBeUndefined();
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

  it("leaves the $ANSEM index row unflagged", () => {
    expect(projectFlags({ ...base, mint: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump", sniper: true, launchCount: 8 })).toEqual([]);
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
    expect(provenanceLabel("match")).toBe("Same wallet");
    expect(provenanceLabel("mismatch")).toBe("Burn wallet ≠ deployer");
    expect(provenanceLabel("unknown")).toBe("Not checked");
    expect(provenanceLabel(undefined)).toBe("Not checked");
  });
});

describe("riskScore", () => {
  it("caps at 100", () => {
    expect(riskScore(projectFlags({ ...base, walletProvenance: "mismatch", holderTop10Pct: 0.9, live: live({ liquidity: 100 }), burnAmount: 50, verifiedBurn: 1 }))).toBeLessThanOrEqual(100);
  });
});
