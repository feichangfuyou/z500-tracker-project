import { describe, expect, it } from "vitest";
import { projectRubric } from "./rubric";
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

const empty = {
  walletProvenance: "unknown" as const,
  holderTop10Pct: null as number | null,
  insiderPct: null as number | null,
  sniper: undefined as boolean | undefined,
  live: live(),
  status: "on_curve",
  tier: "Free",
  verifiedBurn: null as number | null,
  burnAmount: 0,
  addedAt: 0,
  launchCount: 0,
  launchWallet: null as string | null,
};

const clean = {
  ...empty,
  walletProvenance: "matched" as const,
  holderTop10Pct: 0.2,
  insiderPct: 0,
  sniper: false,
  live: live({ liquidity: 50_000 }),
  status: "migrated",
  verifiedBurn: 12,
  launchCount: 1,
  launchWallet: "Aaa",
};

describe("projectRubric", () => {
  it("marks an unchecked coin incomplete", () => {
    const rubric = projectRubric(empty);
    expect(rubric.mark).toBe("unchecked");
    expect(rubric.label).toBe("Incomplete");
    expect(rubric.rows.every((r) => r.mark === "unchecked")).toBe(true);
  });

  it("marks a clean migrated coin clear", () => {
    const rubric = projectRubric(clean, { sameBlockWallets: 1, sniper: false });
    expect(rubric.mark).toBe("pass");
    expect(rubric.label).toBe("Clear");
    expect(rubric.risk).toBe(0);
    expect(rubric.rows.every((r) => r.mark === "pass")).toBe(true);
  });

  it("passes when the listed burn wallet is not the pump deployer", () => {
    const rubric = projectRubric({ ...clean, walletProvenance: "mismatch" });
    expect(rubric.mark).toBe("pass");
    expect(rubric.label).toBe("Clear");
    const wallet = rubric.rows.find((r) => r.id === "wallet");
    expect(wallet?.mark).toBe("pass");
    expect(wallet?.note).toContain("burn wallet");
  });

  it("warns on gold with no burn scan", () => {
    const rubric = projectRubric({ ...empty, tier: "Gold", launchWallet: "Aaa", launchCount: 1 });
    expect(rubric.rows.find((r) => r.id === "burns")?.mark).toBe("warn");
    expect(rubric.mark).toBe("warn");
    expect(rubric.label).toBe("Caution");
  });

  it("warns then fails holder concentration", () => {
    expect(projectRubric({ ...clean, holderTop10Pct: 0.6 }).rows.find((r) => r.id === "holders")?.mark).toBe("warn");
    expect(projectRubric({ ...clean, holderTop10Pct: 0.8 }).rows.find((r) => r.id === "holders")?.mark).toBe("fail");
  });

  it("passes when z500 credits project burns the launch wallet did not hold", () => {
    const row = projectRubric({ ...clean, tier: "Diamond", verifiedBurn: 0, listedBurn: 370_566 }).rows.find(
      (r) => r.id === "burns",
    );
    expect(row?.mark).toBe("pass");
  });

  it("fails a claimed burn the chain does not back", () => {
    const row = projectRubric({ ...clean, burnAmount: 100, verifiedBurn: 10 }).rows.find((r) => r.id === "burns");
    expect(row?.mark).toBe("fail");
  });
});
