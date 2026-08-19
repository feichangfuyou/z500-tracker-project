import { NextResponse } from "next/server";
import { flagsForMint, flagsForWallet, publicFlag } from "@/lib/flag-ledger";
import { flagCloseStats } from "@/lib/flag-resolve";
import { isValidAddress } from "@/lib/guardrails";
import { limited, limitResponse } from "@/lib/limit";
import { PUBLIC_CORS, PUBLIC_HEADERS } from "@/lib/public";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

export const FLAG_NOTE =
  "Serial flags are timestamped when a wallet crosses 5 or 8 launches. After 14 days we close them as confirmed_rug or held when liquidity is known. rugRate is confirmed_rug ÷ closed flags and is omitted until a flag closes.";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
}

export async function GET(req: Request) {
  if (await limited(req, "read")) return limitResponse("read");
  try {
    const url = new URL(req.url);
    const wallet = url.searchParams.get("wallet")?.trim() || "";
    const mint = url.searchParams.get("mint")?.trim() || "";
    if (wallet && !isValidAddress(wallet)) {
      return NextResponse.json({ error: "Wallet looks invalid." }, { status: 400, headers: PUBLIC_CORS });
    }
    if (mint && !isValidAddress(mint)) {
      return NextResponse.json({ error: "Mint looks invalid." }, { status: 400, headers: PUBLIC_CORS });
    }
    const store = await readStore();
    let flags = store.flagsIssued || [];
    if (wallet) flags = flagsForWallet(flags, wallet);
    if (mint) flags = flagsForMint(flags, mint);
    const stats = flagCloseStats(flags);
    return NextResponse.json(
      {
        at: Date.now(),
        note: FLAG_NOTE,
        issued: stats.issued,
        open: stats.open,
        due: stats.due,
        resolved: stats.resolved,
        confirmedRug: stats.confirmedRug,
        held: stats.held,
        ...(stats.rugRate != null ? { rugRate: stats.rugRate } : {}),
        flags: flags.slice(0, 100).map(publicFlag),
      },
      { headers: PUBLIC_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't load flags." }, { status: 502, headers: PUBLIC_CORS });
  }
}
