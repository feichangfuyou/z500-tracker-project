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

export const LINK_ORDER: { key: keyof TradeLinks; label: string }[] = [
  { key: "ansem", label: "ansem.io" },
  { key: "bullpen", label: "Bullpen" },
  { key: "axiom", label: "Axiom" },
  { key: "jupiter", label: "Jupiter" },
  { key: "dex", label: "DexScreener" },
  { key: "gmgn", label: "GMGN" },
  { key: "pump", label: "pump.fun" },
  { key: "solscan", label: "Solscan" },
];
