import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/board";
import { compactBoard, PUBLIC_CORS, PUBLIC_HEADERS, publicCoin } from "@/lib/public";
import { limited, limitResponse } from "@/lib/limit";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
}

export async function GET(req: Request) {
  if (await limited(req, "read")) return limitResponse("read");
  try {
    const board = compactBoard(await buildBoard());
    return NextResponse.json(
      {
        at: board.lastSynced,
        ansemPrice: board.ansemPrice,
        coins: board.projects.slice(0, 100).map(publicCoin),
      },
      { headers: PUBLIC_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't load the board." }, { status: 502, headers: PUBLIC_CORS });
  }
}
