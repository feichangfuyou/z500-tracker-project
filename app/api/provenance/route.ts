import { NextResponse } from "next/server";
import { isValidAddress } from "@/lib/guardrails";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { resolveProvenance } from "@/lib/provenance";
import { readStore, withStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

const FRESH_MS = 30 * 60 * 1000;

export async function POST(req: Request) {
  if (await limited(req, "rpc")) return limitResponse("rpc");
  const parsed = await readJson<{ mint?: string; wallet?: string }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const mint = (parsed.value.mint || "").trim();
  const wallet = (parsed.value.wallet || "").trim() || null;
  if (!isValidAddress(mint)) {
    return NextResponse.json({ error: "Mint looks invalid." }, { status: 400 });
  }

  const snapshot = await readStore();
  const provenance = snapshot.provenance[mint] || null;
  const cached =
    provenance && Date.now() - provenance.at < FRESH_MS
      ? { ...provenance, dossier: snapshot.dossiers[mint] || null }
      : null;
  if (cached) return NextResponse.json(cached);

  try {
    const resolved = await resolveProvenance(mint, wallet);
    const saved = await withStore((store) => {
      store.provenance[mint] = {
        creator: resolved.creator,
        status: resolved.status,
        at: resolved.at,
      };
      const prev = store.dossiers[mint];
      store.dossiers[mint] = {
        at: resolved.at,
        holders: prev?.holders || [],
        creator: resolved.creator,
        onchainCreator: resolved.sources.onchain,
        pumpCreator: resolved.sources.pump,
        createSig: resolved.createSig,
        createSlot: resolved.createSlot,
        sameBlockBuys: resolved.bundle.sameBlockBuys,
        sameBlockWallets: resolved.bundle.sameBlockWallets,
        sniper: resolved.bundle.sniper || Boolean(prev?.sniper),
      };
      return { ...store.provenance[mint], dossier: store.dossiers[mint] };
    });
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Couldn't check launch-wallet provenance." }, { status: 502 });
  }
}
