import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/board";
import { limited, limitResponse } from "@/lib/limit";
import { paidRadar, publicRadarRow, radarStats } from "@/lib/paid-radar";
import { PUBLIC_CORS, PUBLIC_HEADERS } from "@/lib/public";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
}

export async function GET(req: Request) {
  if (await limited(req, "read")) return limitResponse("read");
  try {
    const board = await buildBoard();
    const rows = paidRadar(board.projects);
    return NextResponse.json(
      {
        at: board.lastSynced,
        ...radarStats(board.projects, rows),
        coins: rows.map(publicRadarRow),
      },
      { headers: PUBLIC_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't load the radar." }, { status: 502, headers: PUBLIC_CORS });
  }
}
