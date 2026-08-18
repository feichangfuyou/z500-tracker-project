import { NextResponse } from "next/server";
import { BASE58 } from "@/lib/format";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { fetchOnchainBurns } from "@/lib/solana";
import { readStore, withStore } from "@/lib/store";
import { burnDeltaEvent, burnEvents, pushTape } from "@/lib/tape";
import type { TapeEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const FRESH_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  if (await limited(req, "rpc")) return limitResponse("rpc");
  const parsed = await readJson<{ wallet?: string; deep?: boolean }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;
  const wallet = (body.wallet || "").trim();
  if (!BASE58.test(wallet)) {
    return NextResponse.json({ error: "Launch wallet looks invalid." }, { status: 400 });
  }

  const cached = (await readStore()).burns[wallet] || null;
  const fresh = Boolean(cached && Date.now() - cached.scannedAt < FRESH_MS && !body.deep);
  if (fresh && cached?.exhausted) return NextResponse.json(cached);

  try {
    const continueOlder = Boolean(body.deep || (cached && !cached.exhausted));
    const scan = await fetchOnchainBurns(wallet, {
      cursor: cached?.cursor,
      headSig: cached?.headSig,
      continueOlder,
      indexedBy: cached?.indexedBy ?? null,
      reindex: Boolean(body.deep),
    });
    const saved = await withStore((store) => {
      const prev = store.burns[wallet];
      const prevBurn = prev?.verifiedBurn || 0;
      const wipe = Boolean(scan.replace && prevBurn > 0 && scan.txChecked === 0);
      const next = {
        wallet,
        verifiedBurn: wipe ? prevBurn : scan.replace ? scan.verifiedBurn : prevBurn + scan.verifiedBurn,
        txChecked: wipe ? prev?.txChecked || 0 : scan.replace ? scan.txChecked : (prev?.txChecked || 0) + scan.txChecked,
        txBurned: wipe ? prev?.txBurned || 0 : scan.replace ? scan.txBurned : (prev?.txBurned || 0) + scan.txBurned,
        scannedAt: Date.now(),
        cursor: wipe ? prev?.cursor ?? scan.cursor : scan.cursor,
        exhausted: wipe ? false : scan.exhausted,
        headSig: wipe ? prev?.headSig ?? scan.headSig : scan.headSig,
        indexedBy: wipe ? prev?.indexedBy : scan.indexedBy ?? prev?.indexedBy,
      };
      store.burns[wallet] = next;
      if (scan.events.length || scan.verifiedBurn > 0) {
        const coins = (store.coinSnapshot.coins || []) as {
          mint?: string;
          name?: string;
          ticker?: string;
          slug?: string;
          creatorWallet?: string;
        }[];
        const coin =
          coins.find((c) => c.creatorWallet === wallet) ||
          store.community.find((p) => p.launchWallet === wallet);
        const named = {
          mint: coin?.mint || wallet,
          name: coin?.name || "Unknown",
          ticker: coin && "ticker" in coin ? coin.ticker : undefined,
          slug: coin && "slug" in coin ? coin.slug : undefined,
          status: null,
        };
        const events: TapeEvent[] = scan.events.length
          ? burnEvents(scan.events, named)
          : [burnDeltaEvent(scan.verifiedBurn, named, wallet)].filter((e): e is TapeEvent => Boolean(e));
        store.tape = pushTape(store.tape || [], events);
      }
      return next;
    });
    return NextResponse.json(saved);
  } catch (err) {
    console.error("verify failed", err);
    return NextResponse.json({ error: "Couldn't reach Solana RPC — try again." }, { status: 502 });
  }
}
