import { seedBoard } from "@/lib/public";
import { Tracker } from "@/components/tracker";
import { buildBoard } from "@/lib/board";
import { EMPTY_BOARD_STATS, type BoardResponse } from "@/lib/types";

export const revalidate = 20;

async function loadBoard(): Promise<BoardResponse> {
  try {
    const board = seedBoard(await buildBoard());
    return { ...board, sid: "" };
  } catch {
    return {
      projects: [],
      ansemPrice: null,
      solPrice: null,
      stats: EMPTY_BOARD_STATS,
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
