import { NextResponse } from "next/server";
import { BASE58 } from "@/lib/format";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { ingestWalletScan, namedLaunchForWallet } from "@/lib/burn-ledger";
import { fetchOnchainBurns } from "@/lib/solana";
import { readStore, withStore } from "@/lib/store";

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
  if (fresh && cached?.exhausted) return NextResponse.json({ ...cached, hits: [] });

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
      const coins = (store.coinSnapshot.coins || []) as {
        mint?: string;
        name?: string;
        ticker?: string;
        slug?: string;
        creatorWallet?: string;
      }[];
      const ingested = ingestWalletScan({
        wallet,
        scan,
        burns: store.burns,
        ledger: store.burnLedger || [],
        tape: store.tape || [],
        named: namedLaunchForWallet(wallet, coins, store.community),
      });
      store.burns = ingested.burns;
      store.burnLedger = ingested.ledger;
      store.tape = ingested.tape;
      return { ...ingested.cache, hits: ingested.fresh };
    });
    return NextResponse.json(saved);
  } catch (err) {
    console.error("verify failed", err);
    return NextResponse.json({ error: "Couldn't reach Solana RPC — try again." }, { status: 502 });
  }
}
