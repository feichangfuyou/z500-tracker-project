import { describe, expect, it } from "vitest";
import { compactBoard, publicCoin } from "./public";
import { EMPTY_BOARD_STATS, type Project } from "./types";

describe("publicCoin", () => {
  it("exposes a slim CORS-safe coin", () => {
    const coin = publicCoin({
      mint: "Mint111111111111111111111111111111111111111",
      name: "Alpha",
      ticker: "A",
      slug: "alpha",
      tier: "Gold",
      status: "migrated",
      score: 12,
      officialRank: 3,
      officialDelta: 1,
      live: { marketCap: 100, airdropMcap: 50, priceUsd: 1, change24h: 0, liquidity: 1, fdv: 100, volume24h: 1 },
      verifiedBurn: 9,
      boostPoints: 2,
      flags: [],
      launchWallet: "Wallet1111111111111111111111111111111111111",
      walletProvenance: "match",
      imageUrl: null,
      bannerUrl: "https://ansem.io/api/banners/abc",
      enhancedAt: "2026-08-18T13:57:56.400Z",
    } as unknown as Project);
    expect(coin.mint).toContain("Mint");
    expect(coin.ticker).toBe("A");
    expect(coin.burned).toBe(9);
    expect(coin.provenance).toBe("match");
    expect(coin.ansemUrl).toContain("/coin/alpha");
    expect(coin.launchCount).toBe(0);
    expect(coin.listedRank).toBe(3);
    expect(coin.scoreKind).toBe("proxy");
    expect(coin.rankBasis).toBe("listed-inputs");
    expect(coin.burnedComplete).toBe(false);
    expect(coin.bannerUrl).toBe("https://ansem.io/api/banners/abc");
    expect(coin.enhancedAt).toBe("2026-08-18T13:57:56.400Z");
  });

  it("drops unused board fields", () => {
    const slim = compactBoard({
      projects: [
        {
          id: "ansem:a",
          source: "ansem",
          name: "Alpha",
          mint: "Mint111111111111111111111111111111111111111",
          ticker: "A",
          slug: "alpha",
          tier: "Free",
          launchWallet: null,
          bannerUrl: "https://ansem.io/x",
          enhancedAt: "2026-08-18T00:00:00.000Z",
          burnAmount: 0,
          burnPriceRef: 1,
          verifiedBurn: 9,
          verifiedTxChecked: 4,
          verifiedAt: 1,
          addedAt: 1,
          addedBy: null,
          reports: 0,
          hidden: false,
          live: {
            priceUsd: 1,
            marketCap: 100,
            fdv: 200,
            airdropMcap: 50,
            volume24h: 3,
            change24h: 1,
            liquidity: 9,
            dexUrl: "https://dexscreener.com/solana/x",
            symbol: "A",
            name: "Alpha",
          },
          lastUpdated: 1,
          rankDelta: 0,
          boostPoints: 0,
          boostGolden: false,
          boostExpiresAt: null,
          listedAirdropMcap: 50,
          listedMarketCap: 100,
          officialRank: 1,
          officialDelta: 0,
          score: 12,
          flags: [],
          launchCount: 1,
        },
      ],
      ansemPrice: 0.2,
      solPrice: 150,
      stats: { ...EMPTY_BOARD_STATS, coins: 1, airdroppedUsd: 1, burnedAnsem: 1, holders: 1, scannedWallets: 1, lastScanAt: 1 },
      lastSynced: 1,
      feedSource: "ansem",
      tape: [],
      alerts: { telegram: false, discord: false },
    });
    const row = slim.projects[0];
    expect(row?.name).toBe("Alpha");
    expect(row?.verifiedBurn).toBe(9);
    expect(row?.live?.marketCap).toBe(100);
    expect(row?.live && "fdv" in row.live).toBe(false);
    expect(row && "bannerUrl" in row).toBe(false);
    expect(JSON.stringify(slim).length).toBeLessThan(1200);
  });

  it("omits images on lite polls", () => {
    const slim = compactBoard(
      {
        projects: [
          {
            id: "ansem:a",
            source: "ansem",
            name: "Alpha",
            mint: "Mint111111111111111111111111111111111111111",
            ticker: "A",
            tier: "Free",
            launchWallet: null,
            imageUrl: "https://ipfs.io/ipfs/x",
            burnAmount: 0,
            burnPriceRef: 0,
            verifiedBurn: 1,
            verifiedTxChecked: null,
            verifiedAt: null,
            addedAt: 1,
            addedBy: null,
            reports: 0,
            hidden: false,
            live: null,
            lastUpdated: null,
            rankDelta: 0,
            boostPoints: 0,
            boostGolden: false,
            boostExpiresAt: null,
            listedAirdropMcap: null,
            listedMarketCap: null,
            officialRank: 1,
            officialDelta: 0,
            score: 1,
            flags: [],
            launchCount: 1,
          },
        ],
        ansemPrice: 1,
        solPrice: 1,
        stats: { ...EMPTY_BOARD_STATS, coins: 1, airdroppedUsd: 1, burnedAnsem: 1, holders: 1, scannedWallets: 1, lastScanAt: 1 },
        lastSynced: 1,
        feedSource: "ansem",
        tape: [],
        alerts: { telegram: false, discord: false },
      },
      { lite: true },
    );
    expect(slim.projects[0] && "imageUrl" in slim.projects[0]).toBe(false);
  });
});
