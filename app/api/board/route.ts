import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/board";
import { NO_STORE } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { compactBoard } from "@/lib/public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (await limited(req, "read")) return limitResponse("read");
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const lite = new URL(req.url).searchParams.get("lite") === "1";
  try {
    const board = compactBoard(await buildBoard(fresh), { lite });
    return NextResponse.json(
      { ...board, sid: "" },
      {
        headers: fresh
          ? NO_STORE
          : { "cache-control": "public, s-maxage=8, stale-while-revalidate=20", vary: "accept" },
      },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't load the board." }, { status: 502, headers: NO_STORE });
  }
}
