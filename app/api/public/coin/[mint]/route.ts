import { NextResponse } from "next/server";
import { loadCoin } from "@/lib/coin";
import { isValidAddress } from "@/lib/guardrails";
import { PUBLIC_CORS, PUBLIC_HEADERS, publicCoin } from "@/lib/public";
import { limited, limitResponse } from "@/lib/limit";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
}

export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) {
  if (await limited(req, "read")) return limitResponse("read");
  const { mint } = await params;
  if (!isValidAddress(mint)) {
    return NextResponse.json({ error: "Mint looks invalid." }, { status: 400, headers: PUBLIC_CORS });
  }
  const payload = await loadCoin(mint);
  if (!payload) {
    return NextResponse.json({ error: "Not on the board." }, { status: 404, headers: PUBLIC_CORS });
  }
  return NextResponse.json(
    { coin: publicCoin(payload.project), dossier: payload.dossier, history: payload.history.slice(-16) },
    { headers: PUBLIC_HEADERS },
  );
}
