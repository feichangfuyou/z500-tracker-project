import { compactBoard } from "@/lib/public";
import { Tracker } from "@/components/tracker";
import { buildBoard } from "@/lib/board";
import type { BoardResponse } from "@/lib/types";

export const revalidate = 20;

async function loadBoard(): Promise<BoardResponse> {
  try {
    const board = compactBoard(await buildBoard());
    return { ...board, sid: "" };
  } catch {
    return {
      projects: [],
      ansemPrice: null,
      solPrice: null,
      stats: { coins: 0, airdroppedUsd: null, burnedAnsem: null, holders: null, boosted: 0, flagged: 0, scannedWallets: 0, lastScanAt: null },
      lastSynced: Date.now(),
      sid: "",
      feedSource: "cache",
      tape: [],
      alerts: { telegram: false, discord: false },
    };
  }
}

export default async function Page() {
  const initial = await loadBoard();
  return <Tracker initial={initial} />;
}
