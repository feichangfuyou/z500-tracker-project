export const ANSEM_ORIGIN = "https://ansem.io";
export const ANSEM_AIRDROP = `${ANSEM_ORIGIN}/airdrop`;
export const ANSEM_Z500 = `${ANSEM_ORIGIN}/z500`;

export type TradeLinks = {
  ansem: string | null;
  dex: string;
  solscan: string;
  jupiter: string;
  axiom: string;
  bullpen: string;
  gmgn: string;
  pump: string;
};

export function ansemCoinUrl(slug: string | null | undefined) {
  if (!slug) return null;
  return `${ANSEM_ORIGIN}/coin/${encodeURIComponent(slug)}`;
}

export function solscanAccount(addr: string) {
  return `https://solscan.io/account/${encodeURIComponent(addr)}`;
}

export function solscanTx(sig: string) {
  return `https://solscan.io/tx/${encodeURIComponent(sig)}`;
}

export function tradeLinks(mint: string, slug?: string | null): TradeLinks {
  const m = mint.trim();
  return {
    ansem: ansemCoinUrl(slug),
    dex: `https://dexscreener.com/solana/${m}`,
    solscan: `https://solscan.io/token/${m}`,
    jupiter: `https://jup.ag/swap/SOL-${m}`,
    axiom: `https://axiom.trade/meme/${m}`,
    bullpen: `https://app.bullpen.fi/?mint=${encodeURIComponent(m)}`,
    gmgn: `https://gmgn.ai/sol/token/${m}`,
    pump: `https://pump.fun/coin/${m}`,
  };
}

const DEX_HOST = /^(?:www\.)?dexscreener\.com$/i;

export function dexEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !DEX_HOST.test(url.hostname)) return null;
    url.hostname = "dexscreener.com";
    url.hash = "";
    url.search = "";
    url.searchParams.set("embed", "1");
    url.searchParams.set("theme", "dark");
    url.searchParams.set("chartTheme", "dark");
    url.searchParams.set("loadChartSettings", "0");
    url.searchParams.set("chartDefaultOnMobile", "1");
    url.searchParams.set("info", "1");
    url.searchParams.set("trades", "1");
    url.searchParams.set("tabs", "1");
    url.searchParams.set("chartLeftToolbar", "0");
    return url.toString();
  } catch {
    return null;
  }
}

export const LINK_ORDER: { key: keyof TradeLinks; label: string; abbr: string }[] = [
  { key: "ansem", label: "ansem.io", abbr: "ANS" },
  { key: "bullpen", label: "Bullpen", abbr: "BULL" },
  { key: "axiom", label: "Axiom", abbr: "AXM" },
  { key: "jupiter", label: "Jupiter", abbr: "JUP" },
  { key: "dex", label: "DexScreener", abbr: "DEX" },
  { key: "gmgn", label: "GMGN", abbr: "GMGN" },
  { key: "pump", label: "pump.fun", abbr: "PUMP" },
  { key: "solscan", label: "Solscan", abbr: "SCAN" },
];
