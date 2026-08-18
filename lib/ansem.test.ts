import { describe, expect, it } from "vitest";
import { bannerUrlFrom, enhancedAtFrom, isEnhanced, mapAnsemMarket, mapDexPair, mapPumpCoin } from "./ansem";

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
