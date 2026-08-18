import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/board";
import { indexFromProjects } from "@/lib/index-day";
import { limited, limitResponse } from "@/lib/limit";
import { PUBLIC_CORS, PUBLIC_HEADERS } from "@/lib/public";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
}

export async function GET(req: Request) {
  if (await limited(req, "read")) return limitResponse("read");
  try {
    const store = await readStore();
    if (store.indexDays?.length) {
      return NextResponse.json({ days: store.indexDays }, { headers: PUBLIC_HEADERS });
    }
    const board = await buildBoard().catch(() => null);
    const live = board ? indexFromProjects(board.projects) : null;
    return NextResponse.json({ days: live ? [live] : [] }, { headers: PUBLIC_HEADERS });
  } catch {
    return NextResponse.json({ error: "Couldn't load the index." }, { status: 502, headers: PUBLIC_CORS });
  }
}
