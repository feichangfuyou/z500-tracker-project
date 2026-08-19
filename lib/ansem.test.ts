import { describe, expect, it } from "vitest";
import { bannerUrlFrom, creditedBurn, enhancedAtFrom, isEnhanced, listedAirdropCaption, mapAnsemMarket, mapAnsemStats, mapDexPair, mapPumpCoin, mergeProjectBurns, projectBurnsByMint, resolveListedCoins } from "./ansem";

describe("mapPumpCoin", () => {
  it("maps a pump.fun coin into the discovery shape", () => {
    const mapped = mapPumpCoin({
      mint: "Mint111111111111111111111111111111111111111",
      name: "Frog",
      symbol: "FROG",
      creator: "Creator11111111111111111111111111111111111",
      usd_market_cap: 12000,
      created_timestamp: Date.parse("2026-01-01T00:00:00Z"),
    });
    expect(mapped?.ticker).toBe("FROG");
    expect(mapped?.marketCapUsd).toBe(12000);
    expect(mapped?.creatorWallet).toMatch(/^Creator/);
    expect(mapped?.bannerUrl).toBeNull();
  });

  it("rewrites pump.fun IPFS artwork onto ipfs.io", () => {
    const cid = "bafkreifk5tpndk6lj5csnhybvhpaqy2clmy6bzyvwnu2mslo5xcm3pyn44";
    const mapped = mapPumpCoin({
      mint: "Mint111111111111111111111111111111111111111",
      name: "Frog",
      symbol: "FROG",
      image_uri: `https://pump.mypinata.cloud/ipfs/${cid}`,
    });
    expect(mapped?.imageUrl).toBe(`https://ipfs.io/ipfs/${cid}`);
  });

  it("keeps a https banner from pump.fun", () => {
    const mapped = mapPumpCoin({
      mint: "Mint111111111111111111111111111111111111111",
      name: "Frog",
      symbol: "FROG",
      banner_uri: "https://ipfs.io/ipfs/bafkreifk5tpndk6lj5csnhybvhpaqy2clmy6bzyvwnu2mslo5xcm3pyn44",
    });
    expect(mapped?.bannerUrl).toBe(
      "https://ipfs.io/ipfs/bafkreifk5tpndk6lj5csnhybvhpaqy2clmy6bzyvwnu2mslo5xcm3pyn44",
    );
  });

  it("drops coins without a mint", () => {
    expect(mapPumpCoin({ name: "nope" })).toBeNull();
  });
});

describe("mapAnsemStats", () => {
  it("reads token count, ATH usd, and wallets from /api/stats", () => {
    expect(
      mapAnsemStats({
        airdropped: {
          tokens: 2_325_003_984.2873874,
          claimedTokens: 33_187_461.818,
          usd: 615_679.577,
          usdNow: 121_311.925,
          pricedShare: 1,
          coins: 43,
          wallets: 29_413,
        },
        holders: { count: 146_000 },
        burned: { total: 1_493_480.779595 },
      }),
    ).toEqual({
      airdroppedTokens: 2_325_003_984.2873874,
      airdroppedUsd: 615_679.577,
      airdroppedUsdNow: 121_311.925,
      airdroppedCoins: 43,
      airdroppedWallets: 29_413,
      airdroppedPricedShare: 1,
      claimedTokens: 33_187_461.818,
      burnedAnsem: 1_493_480.779595,
      holders: 146_000,
    });
  });

  it("returns nulls when the payload is empty", () => {
    expect(mapAnsemStats(null)).toEqual({
      airdroppedTokens: null,
      airdroppedUsd: null,
      airdroppedUsdNow: null,
      airdroppedCoins: null,
      airdroppedWallets: null,
      airdroppedPricedShare: null,
      claimedTokens: null,
      burnedAnsem: null,
      holders: null,
    });
  });
});

describe("listedAirdropCaption", () => {
  it("matches ansem.io: ATH dollars, coin count, wallets", () => {
    expect(
      listedAirdropCaption({
        airdroppedTokens: 2_325_003_984.2873874,
        airdroppedUsd: 615_679.577,
        airdroppedCoins: 43,
        airdroppedWallets: 29_413,
        airdroppedPricedShare: 1,
      }),
    ).toBe("≈ $615.7K · 43 coins · 29.4K wallets");
  });

  it("marks a partial priced share with a plus", () => {
    expect(
      listedAirdropCaption({
        airdroppedTokens: 1_000,
        airdroppedUsd: 10,
        airdroppedCoins: 1,
        airdroppedWallets: 12,
        airdroppedPricedShare: 0.5,
      }),
    ).toBe("≈ $10.00+ · 1 coin · 12 wallets");
  });

  it("falls back when nothing has been distributed", () => {
    expect(listedAirdropCaption({ airdroppedTokens: 0, airdroppedUsd: null, airdroppedCoins: null, airdroppedWallets: null, airdroppedPricedShare: null })).toBe(
      "Distributed at migration",
    );
  });
});

describe("mapAnsemMarket", () => {
  it("reads ANSEM and SOL quotes", () => {
    expect(
      mapAnsemMarket({ quote: { priceUsd: 0.269, solUsd: 76.14 } }),
    ).toEqual({ priceUsd: 0.269, solUsd: 76.14 });
  });

  it("returns nulls when the quote is missing", () => {
    expect(mapAnsemMarket(null)).toEqual({ priceUsd: null, solUsd: null });
    expect(mapAnsemMarket({})).toEqual({ priceUsd: null, solUsd: null });
  });
});

describe("enhanced listing", () => {
  it("reads enhancedAt and ignores a banner-only listing", () => {
    expect(enhancedAtFrom({ enhancedAt: "2026-08-18T13:57:56.400Z" })).toBe("2026-08-18T13:57:56.400Z");
    expect(enhancedAtFrom({ enhancedAt: "nope" })).toBeNull();
    expect(enhancedAtFrom({ enhancedAt: null })).toBeNull();
    expect(isEnhanced({ enhancedAt: "2026-08-18T13:57:56.400Z" })).toBe(true);
    expect(isEnhanced({ enhancedAt: null })).toBe(false);
    expect(isEnhanced({ enhancedAt: "nope" })).toBe(false);
  });
});

describe("bannerUrlFrom", () => {
  it("prefers the enhanced page banner and ignores empty or unsafe URLs", () => {
    expect(
      bannerUrlFrom({
        bannerUrl: "https://ansem.io/api/banners/old",
        enhancedContent: { bannerUrl: "https://ansem.io/api/banners/abc" },
      }),
    ).toBe("https://ansem.io/api/banners/abc");
    expect(bannerUrlFrom({ bannerUrl: "https://ansem.io/api/banners/abc" })).toBe(
      "https://ansem.io/api/banners/abc",
    );
    expect(bannerUrlFrom({ enhancedContent: { bannerUrl: null } })).toBeNull();
    expect(bannerUrlFrom({ bannerUrl: "javascript:alert(1)" })).toBeNull();
    expect(bannerUrlFrom({ bannerUrl: "  " })).toBeNull();
  });
});

describe("mapDexPair", () => {
  it("keeps solana pairs and skips other chains", () => {
    expect(
      mapDexPair({
        chainId: "solana",
        baseToken: { address: "Mint111111111111111111111111111111111111111", name: "Frog", symbol: "FROG" },
        marketCap: 50,
      })?.ticker,
    ).toBe("FROG");
    expect(
      mapDexPair({
        chainId: "ethereum",
        baseToken: { address: "0xabc", name: "Frog", symbol: "FROG" },
      }),
    ).toBeNull();
  });
});

describe("projectBurnsByMint", () => {
  it("indexes credited project burns by mint", () => {
    expect(
      projectBurnsByMint([
        { mint: "eye", amount: 370_566, burners: 8 },
        { amount: 1 },
      ]),
    ).toEqual({ eye: { amount: 370_566, burners: 8 } });
  });
});

describe("resolveListedCoins", () => {
  const alpha = { mint: "MintA", name: "Alpha", ticker: "A", slug: "a", tier: "free" };

  it("keeps a live ansem.io list", () => {
    expect(resolveListedCoins([alpha], { coins: [], at: 0 }, 50)).toEqual({
      coins: [alpha],
      source: "ansem",
      listedAt: 50,
    });
  });

  it("falls back to the saved snapshot when live is empty or missing", () => {
    expect(resolveListedCoins([], { coins: [alpha], at: 9 }, 50)).toEqual({
      coins: [alpha],
      source: "cache",
      listedAt: 9,
    });
    expect(resolveListedCoins(null, { coins: [alpha], at: 9 }, 50).source).toBe("cache");
  });

  it("stays empty when there is no snapshot either", () => {
    expect(resolveListedCoins([], { coins: [], at: 0 }, 50)).toEqual({
      coins: [],
      source: "empty",
      listedAt: null,
    });
  });
});

describe("mergeProjectBurns", () => {
  it("keeps the last good snapshot when live is empty", () => {
    const cached = { eye: { amount: 370_566, burners: 8 } };
    expect(mergeProjectBurns({}, cached)).toEqual(cached);
    expect(mergeProjectBurns({ z: { amount: 1, burners: 1 } }, cached)).toEqual({ z: { amount: 1, burners: 1 } });
  });
});

describe("creditedBurn", () => {
  it("uses 0 when the feed loaded and the mint is not on the project board", () => {
    const feed = projectBurnsByMint([{ mint: "eye", amount: 370_566, burners: 8 }]);
    expect(creditedBurn("eye", feed)).toEqual({ amount: 370_566, burners: 8 });
    expect(creditedBurn("rtm", feed)).toEqual({ amount: 0, burners: 0 });
    expect(creditedBurn("rtm", {})).toEqual({ amount: null, burners: null });
  });
});
