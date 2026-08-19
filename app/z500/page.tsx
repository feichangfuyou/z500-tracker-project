import { seedBoard } from "@/lib/public";
import { Tracker } from "@/components/tracker";
import { buildBoard } from "@/lib/board";
import { EMPTY_BOARD_STATS, type BoardResponse } from "@/lib/types";
import type { Metadata } from "next";

export const revalidate = 20;

export const metadata: Metadata = {
  title: "Z500",
  description:
    "Live z500 index: circulating market cap, $ANSEM at #1, every ansem.io launch including NSFW. Unofficial — not built by ansem.io.",
};

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

export default async function Z500Page() {
  const initial = await loadBoard();
  return <Tracker initial={initial} variant="index" />;
}
