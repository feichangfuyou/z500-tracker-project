import { matchLaunchWallet } from "./guardrails";
import { isProgramPubkey, liveWallet } from "./programs";
import { fetchMintCreateWindow } from "./solana";
import type { Dossier, ProvenanceStatus } from "./types";

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

export function provenanceStatus(
  listed: string | null | undefined,
  onchain: string | null | undefined,
  pump: string | null | undefined,
): ProvenanceStatus {
  return matchLaunchWallet(listed, liveWallet(onchain), liveWallet(pump));
}

export function provenanceFromStore(
  listed: string | null | undefined,
  dossier: Pick<Dossier, "onchainCreator" | "pumpCreator" | "createSig"> | null | undefined,
  _cached?: { creator: string | null; status?: ProvenanceStatus } | null,
): ProvenanceStatus {
  const onchain = dossier?.createSig ? dossier.onchainCreator : null;
  const pump = dossier?.pumpCreator ?? null;
  return provenanceStatus(listed, onchain, pump);
}

export function provenanceCacheForEnrich<T extends { creator: string | null; at: number }>(
  cache: Record<string, T>,
) {
  const out: Record<string, T> = {};
  for (const [mint, row] of Object.entries(cache)) {
    out[mint] = isProgramPubkey(row.creator) ? { ...row, at: 0 } : row;
  }
  return out;
}

export async function resolveProvenance(mint: string, launchWallet: string | null) {
  const [pump, window] = await Promise.all([
    fetchPumpCreator(mint),
    fetchMintCreateWindow(mint).catch(() => null),
  ]);
  const onchain = liveWallet(window?.creator) ?? null;
  const pumpWallet = liveWallet(pump);
  return {
    creator: onchain || pumpWallet,
    status: provenanceStatus(launchWallet, onchain, pumpWallet),
    at: Date.now(),
    freshFor: FRESH_MS,
    sources: { pump: pumpWallet, onchain },
    createSig: onchain ? window?.signature ?? null : null,
    createSlot: onchain ? window?.slot ?? null : null,
    bundle: window?.bundle ?? { sameBlockBuys: 0, sameBlockWallets: 0, sniper: false },
  };
}
