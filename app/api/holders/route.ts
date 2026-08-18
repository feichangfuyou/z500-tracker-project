import { NextResponse } from "next/server";
import { BASE58 } from "@/lib/format";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { fetchHolderRadar } from "@/lib/solana";
import { readStore, withStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

const FRESH_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  if (await limited(req, "rpc")) return limitResponse("rpc");
  const parsed = await readJson<{ mint?: string }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const mint = (parsed.value.mint || "").trim();
  if (!BASE58.test(mint)) {
    return NextResponse.json({ error: "Mint looks invalid." }, { status: 400 });
  }

  const snapshot = await readStore();
  const holders = snapshot.holders[mint] || null;
  const cached =
    holders && Date.now() - holders.at < FRESH_MS
      ? { ...holders, dossier: snapshot.dossiers[mint] || null }
      : null;
  if (cached) return NextResponse.json(cached);

  try {
    const radar = await fetchHolderRadar(mint);
    if (!radar) {
      return NextResponse.json({ error: "No supply data." }, { status: 404 });
    }
    const saved = await withStore((store) => {
      store.holders[mint] = {
        top10Pct: radar.top10Pct,
        at: Date.now(),
        insiderPct: radar.insiderPct,
        sniper: radar.sniper || Boolean(store.dossiers[mint]?.sniper),
        clustered: radar.clustered,
        holders: radar.holders,
      };
      const prev = store.dossiers[mint];
      store.dossiers[mint] = {
        at: Date.now(),
        holders: radar.holders,
        creator: prev?.creator ?? store.provenance[mint]?.creator ?? null,
        onchainCreator: prev?.onchainCreator ?? null,
        pumpCreator: prev?.pumpCreator ?? null,
        createSig: prev?.createSig ?? null,
        createSlot: prev?.createSlot ?? null,
        sameBlockBuys: prev?.sameBlockBuys ?? 0,
        sameBlockWallets: prev?.sameBlockWallets ?? 0,
        sniper: radar.sniper || Boolean(prev?.sniper),
      };
      return { ...store.holders[mint], dossier: store.dossiers[mint] };
    });
    return NextResponse.json(saved);
  } catch (err) {
    console.error("holders", mint, err);
    if (cached) return NextResponse.json(cached);
    return NextResponse.json({ error: "Couldn't read holder concentration." }, { status: 502 });
  }
}
