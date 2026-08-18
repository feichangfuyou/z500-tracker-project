import { describe, expect, it } from "vitest";
import { findWallet, isKnownLaunchWallet, launchWallets, walletAirdropUsd, walletBestOfficial, walletMismatchCount } from "./wallets";
import type { LiveData, Project } from "./types";

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

function project(partial: Partial<Project> & Pick<Project, "id" | "name" | "mint">): Project {
  return {
    source: "ansem",
    tier: "Free",
    launchWallet: null,
    burnAmount: 0,
    burnPriceRef: 0,
    verifiedBurn: null,
    verifiedTxChecked: null,
    verifiedAt: null,
    addedAt: 0,
    addedBy: null,
    reports: 0,
    hidden: false,
    live: null,
    lastUpdated: 0,
    rankDelta: 0,
    boostPoints: 0,
    boostGolden: false,
    boostExpiresAt: null,
    listedAirdropMcap: null,
    listedMarketCap: null,
    officialRank: null,
    officialDelta: null,
    score: 0,
    flags: [],
    launchCount: 0,
    ...partial,
  };
}

describe("launchWallets", () => {
  it("groups coins and prefers diamond wallets", () => {
    const rows = launchWallets([
      project({ id: "1", name: "A", mint: "a", launchWallet: "w1", tier: "Free", verifiedBurn: 1 }),
      project({ id: "2", name: "B", mint: "b", launchWallet: "w2", tier: "Diamond", verifiedBurn: 0 }),
      project({ id: "3", name: "C", mint: "c", launchWallet: "w1", tier: "Gold", verifiedBurn: 4 }),
    ]);
    expect(rows[0]?.wallet).toBe("w2");
    expect(rows.find((r) => r.wallet === "w1")?.coins).toHaveLength(2);
    expect(rows.find((r) => r.wallet === "w1")?.burned).toBe(4);
  });

  it("counts a shared launch-wallet burn once", () => {
    const rows = launchWallets([
      project({ id: "1", name: "A", mint: "a", launchWallet: "w1", verifiedBurn: 10 }),
      project({ id: "2", name: "B", mint: "b", launchWallet: "w1", verifiedBurn: 10 }),
    ]);
    expect(rows[0]?.burned).toBe(10);
  });

  it("finds a wallet dossier and ignores unknown addresses", () => {
    const projects = [
      project({ id: "1", name: "A", mint: "a", launchWallet: "w1", score: 2 }),
      project({ id: "2", name: "B", mint: "b", launchWallet: "w1", score: 9 }),
    ];
    const hit = findWallet(projects, "w1");
    expect(hit?.coins.map((c) => c.mint)).toEqual(["b", "a"]);
    expect(findWallet(projects, "missing")).toBeNull();
  });

  it("marks a wallet serial at five launches", () => {
    const rows = launchWallets([
      project({ id: "1", name: "A", mint: "a", launchWallet: "w1" }),
      project({ id: "2", name: "B", mint: "b", launchWallet: "w1" }),
      project({ id: "3", name: "C", mint: "c", launchWallet: "w1" }),
      project({ id: "4", name: "D", mint: "d", launchWallet: "w1" }),
      project({ id: "5", name: "E", mint: "e", launchWallet: "w1" }),
    ]);
    expect(rows[0]?.serial).toBe("warn");
    expect(rows[0]?.coins).toHaveLength(5);
  });

  it("detects a known launch wallet", () => {
    const projects = [project({ id: "1", name: "A", mint: "a", launchWallet: "w1" })];
    expect(isKnownLaunchWallet(projects, "w1")).toBe(true);
    expect(isKnownLaunchWallet(projects, "w2")).toBe(false);
  });

  it("copies live dossier fields onto each coin", () => {
    const rows = launchWallets([
      project({
        id: "1",
        name: "A",
        mint: "a",
        launchWallet: "w1",
        status: "migrated",
        boostPoints: 12,
        boostGolden: true,
        addedAt: 50,
        officialRank: 7,
        officialDelta: 2,
        live: live({ marketCap: 900, airdropMcap: 400, change24h: -3.5 }),
      }),
    ]);
    expect(rows[0]?.coins[0]).toMatchObject({
      marketCap: 900,
      airdropMcap: 400,
      change24h: -3.5,
      status: "migrated",
      boostPoints: 12,
      boostGolden: true,
      addedAt: 50,
      officialRank: 7,
      officialDelta: 2,
    });
  });

  it("summarizes airdrop, official rank, and mismatches", () => {
    const rows = launchWallets([
      project({
        id: "1",
        name: "A",
        mint: "a",
        launchWallet: "w1",
        officialRank: 9,
        walletProvenance: "mismatch",
        flags: [{ id: "mismatch", label: "Wallet mismatch", severity: "bad" }],
        live: live({ airdropMcap: 100 }),
      }),
      project({
        id: "2",
        name: "B",
        mint: "b",
        launchWallet: "w1",
        officialRank: 3,
        live: live({ airdropMcap: 40 }),
      }),
    ]);
    const row = rows[0]!;
    expect(walletAirdropUsd(row)).toBe(140);
    expect(walletBestOfficial(row)).toBe(3);
    expect(walletMismatchCount(row)).toBe(1);
  });
});
