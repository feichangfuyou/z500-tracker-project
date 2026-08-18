import { NextResponse } from "next/server";
import { isValidAddress } from "@/lib/guardrails";
import { NO_STORE, readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { remoteWatchGet, remoteWatchPut } from "@/lib/remote";
import { attachSessionCookie, getSessionId } from "@/lib/session";
import { readStore, withStore } from "@/lib/store";
import { mergeWatches, parseWatchList } from "@/lib/watch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function watchKeys(sid: string, wallet: string | null) {
  return wallet && isValidAddress(wallet) ? [sid, wallet] : [sid];
}

export async function GET(req: Request) {
  try {
    const sid = await getSessionId();
    const wallet = new URL(req.url).searchParams.get("wallet")?.trim() || null;
    const keys = watchKeys(sid, wallet);
    const remote = await remoteWatchGet(keys);
    if (remote) {
      const mints = mergeWatches(...keys.map((k) => remote[k] || []));
      return attachSessionCookie(NextResponse.json({ sid, mints }, { headers: NO_STORE }), sid);
    }
    const store = await readStore();
    const watches = store.watches || {};
    const mints = mergeWatches(...keys.map((k) => watches[k] || []));
    return attachSessionCookie(NextResponse.json({ sid, mints }, { headers: NO_STORE }), sid);
  } catch {
    return NextResponse.json({ sid: "", mints: [] }, { headers: NO_STORE });
  }
}

export async function PUT(req: Request) {
  if (await limited(req, "write")) return limitResponse("write");
  try {
    const sid = await getSessionId();
    const parsed = await readJson<{ mints?: unknown; wallet?: string }>(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const wallet = (parsed.value.wallet || "").trim() || null;
    if (wallet && !isValidAddress(wallet)) {
      return NextResponse.json({ error: "Wallet looks invalid." }, { status: 400 });
    }
    const incoming = parseWatchList(parsed.value.mints);
    const keys = watchKeys(sid, wallet);
    if (await remoteWatchPut(keys, incoming)) {
      return attachSessionCookie(NextResponse.json({ sid, mints: incoming }, { headers: NO_STORE }), sid);
    }
    const mints = await withStore((store) => {
      store.watches = store.watches || {};
      for (const key of keys) store.watches[key] = incoming;
      return incoming;
    });
    return attachSessionCookie(NextResponse.json({ sid, mints }, { headers: NO_STORE }), sid);
  } catch {
    return NextResponse.json({ error: "Couldn't save the watchlist." }, { status: 503 });
  }
}
