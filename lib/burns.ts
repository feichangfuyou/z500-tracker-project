import type { HeliusIndexResult } from "./helius";
import type { BurnCache } from "./types";

export type BurnScan = Pick<
  HeliusIndexResult,
  "verifiedBurn" | "txChecked" | "txBurned" | "cursor" | "exhausted" | "headSig" | "replace" | "indexedBy"
>;

export function applyBurnScan(wallet: string, prev: BurnCache | undefined, scan: BurnScan, now = Date.now()): BurnCache {
  const prevBurn = prev?.verifiedBurn || 0;
  const wipe = Boolean(scan.replace && prevBurn > 0 && scan.txChecked === 0);
  if (wipe) {
    return {
      wallet,
      verifiedBurn: prevBurn,
      txChecked: prev?.txChecked || 0,
      txBurned: prev?.txBurned || 0,
      scannedAt: now,
      cursor: prev?.cursor ?? scan.cursor,
      exhausted: false,
      headSig: prev?.headSig ?? scan.headSig,
      indexedBy: prev?.indexedBy,
    };
  }
  if (scan.replace) {
    return {
      wallet,
      verifiedBurn: scan.verifiedBurn,
      txChecked: scan.txChecked,
      txBurned: scan.txBurned,
      scannedAt: now,
      cursor: scan.cursor,
      exhausted: scan.exhausted,
      headSig: scan.headSig,
      indexedBy: scan.indexedBy ?? prev?.indexedBy,
    };
  }
  return {
    wallet,
    verifiedBurn: prevBurn + scan.verifiedBurn,
    txChecked: (prev?.txChecked || 0) + scan.txChecked,
    txBurned: (prev?.txBurned || 0) + scan.txBurned,
    scannedAt: now,
    cursor: scan.cursor,
    exhausted: scan.exhausted,
    headSig: scan.headSig,
    indexedBy: scan.indexedBy ?? prev?.indexedBy,
  };
}
