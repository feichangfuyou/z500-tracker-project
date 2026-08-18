import { matchLaunchWallet } from "./guardrails";
import { fetchMintCreateWindow } from "./solana";

const FRESH_MS = 30 * 60 * 1000;

export async function fetchPumpCreator(mint: string) {
  const urls = [
    `https://frontend-api.pump.fun/coins/${mint}`,
    `https://frontend-api-v3.pump.fun/coins/${mint}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "crosscheck/1.0" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { creator?: string; mint?: string };
      if (json?.creator) return String(json.creator);
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function resolveProvenance(mint: string, launchWallet: string | null) {
  const [pump, window] = await Promise.all([
    fetchPumpCreator(mint),
    fetchMintCreateWindow(mint).catch(() => null),
  ]);
  const onchain = window?.creator ?? null;
  return {
    creator: onchain || pump,
    status: matchLaunchWallet(launchWallet, onchain, pump),
    at: Date.now(),
    freshFor: FRESH_MS,
    sources: { pump, onchain },
    createSig: window?.signature ?? null,
    createSlot: window?.slot ?? null,
    bundle: window?.bundle ?? { sameBlockBuys: 0, sameBlockWallets: 0, sniper: false },
  };
}
