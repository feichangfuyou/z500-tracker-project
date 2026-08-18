import { describe, expect, it } from "vitest";
import { overlayDex, type DexLive } from "./dex";
import type { LiveData } from "./types";

const listed: LiveData = {
  priceUsd: 1,
  marketCap: 1000,
  fdv: 1000,
  airdropMcap: 200,
  volume24h: 10,
  change24h: 1,
  liquidity: null,
  dexUrl: "https://dexscreener.com/solana/x",
  symbol: "X",
  name: "Ex",
  mcapSource: "listed",
};

const dex: DexLive = {
  priceUsd: 2,
  marketCap: 4000,
  fdv: 8000,
  volume24h: 99,
  change24h: -3,
  liquidity: 500,
  dexUrl: "https://dexscreener.com/solana/y",
  symbol: "Y",
  name: "Why",
};

describe("overlayDex", () => {
  it("prefers DexScreener circulating mcap and price", () => {
    const out = overlayDex(listed, dex);
    expect(out.priceUsd).toBe(2);
    expect(out.marketCap).toBe(4000);
    expect(out.fdv).toBe(8000);
    expect(out.liquidity).toBe(500);
    expect(out.mcapSource).toBe("dex");
  });

  it("keeps listed data when Dex is missing", () => {
    const out = overlayDex(listed, null);
    expect(out.marketCap).toBe(1000);
    expect(out.mcapSource).toBe("listed");
  });
});
