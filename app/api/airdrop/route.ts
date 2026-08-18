import { NextResponse } from "next/server";
import type { AnsemCoin } from "@/lib/ansem";
import { airdropLedger } from "@/lib/airdrop";
import { isValidAddress } from "@/lib/guardrails";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { fetchWalletMintBalances } from "@/lib/solana";
import { readStore } from "@/lib/store";
import { ANSEM_MINT } from "@/lib/types";
import { isKnownLaunchWallet } from "@/lib/wallets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (await limited(req, "rpc")) return limitResponse("rpc");
  const parsed = await readJson<{ wallet?: string }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const wallet = (parsed.value.wallet || "").trim();
  if (!isValidAddress(wallet)) {
    return NextResponse.json({ error: "Wallet looks invalid." }, { status: 400 });
  }

  try {
    const [store, accounts] = await Promise.all([readStore(), fetchWalletMintBalances(wallet)]);
    const snapshot = (store.coinSnapshot.coins || []) as AnsemCoin[];
    const coins = snapshot
      .filter((c) => !c.nsfw && c.mint !== ANSEM_MINT)
      .map((c) => ({
        mint: c.mint,
        name: c.name,
        ticker: c.ticker,
        slug: c.slug,
        priceUsd: c.priceUsd ?? null,
        imageUrl: c.imageUrl,
        airdropTotal: c.airdropTotal,
      }));
    const ledger = airdropLedger(accounts, coins, ANSEM_MINT);
    const known = [
      ...snapshot.map((c) => ({ launchWallet: c.creatorWallet || null })),
      ...store.community.map((p) => ({ launchWallet: p.launchWallet })),
    ];
    return NextResponse.json({
      wallet,
      knownLaunch: isKnownLaunchWallet(known, wallet),
      ...ledger,
      rows: ledger.claimed,
      checked: accounts.length,
    });
  } catch (err) {
    console.error("airdrop", wallet, err);
    return NextResponse.json({ error: "Couldn't reach Solana RPC — try again." }, { status: 502 });
  }
}
