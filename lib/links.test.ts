import { describe, expect, it } from "vitest";
import { ANSEM_AIRDROP, ANSEM_Z500, ansemCoinUrl, dexEmbedUrl, LINK_ORDER, solscanAccount, solscanTx, tradeLinks } from "./links";

describe("tradeLinks", () => {
  it("builds explorer and terminal URLs from a mint", () => {
    const mint = "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";
    const links = tradeLinks(mint, "black-bull");
    expect(links.ansem).toContain("black-bull");
    expect(links.dex).toContain(mint);
    expect(links.solscan).toContain(mint);
    expect(solscanAccount(mint)).toContain("/account/");
    expect(solscanTx("sig")).toContain("/tx/sig");
    expect(links.jupiter).toContain(mint);
    expect(links.axiom).toContain(mint);
    expect(links.bullpen).toContain(mint);
    expect(LINK_ORDER.length).toBe(8);
    expect(ansemCoinUrl("black-bull")).toBe("https://ansem.io/coin/black-bull");
    expect(ANSEM_AIRDROP).toContain("/airdrop");
    expect(ANSEM_Z500).toContain("/z500");
  });

  it("omits ansem.io when there is no slug", () => {
    expect(tradeLinks("Mint111111111111111111111111111111111111111").ansem).toBeNull();
  });
});

describe("dexEmbedUrl", () => {
  it("turns a DexScreener pair URL into a dark embed", () => {
    const src = dexEmbedUrl("https://dexscreener.com/solana/AbCd?foo=1#x");
    expect(src).toBe(
      "https://dexscreener.com/solana/AbCd?embed=1&theme=dark&chartTheme=dark&loadChartSettings=0&chartDefaultOnMobile=1&info=1&trades=1&tabs=1&chartLeftToolbar=0",
    );
  });

  it("rejects non-DexScreener hosts", () => {
    expect(dexEmbedUrl("https://evil.test/solana/x")).toBeNull();
    expect(dexEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
