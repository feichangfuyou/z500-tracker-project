"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnsemCta } from "@/components/ansem-cta";
import { CoinThumb } from "@/components/coin-thumb";
import { CopyAddr } from "@/components/copy-addr";
import { LiveNum } from "@/components/live-num";
import { MiniStat, MiniStatGrid } from "@/components/mini-stat";
import { PageBack } from "@/components/page-back";
import { Reveal } from "@/components/reveal";
import { ScrambleText } from "@/components/scramble-text";
import { SiteHeader } from "@/components/site-header";
import type { HoldingRow } from "@/lib/airdrop";
import { fmtCompact, fmtInt, fmtPrice, fmtUsd, shortAddr } from "@/lib/format";
import { ANSEM_AIRDROP, ansemCoinUrl } from "@/lib/links";

type Ledger = {
  claimed: HoldingRow[];
  claimable: HoldingRow[];
  sold: HoldingRow[];
  holdsAnsem: boolean;
  totalUsd: number | null;
  wallet: string;
  knownLaunch: boolean;
};

export function AirdropView() {
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/airdrop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't read that wallet.");
      setLedger({
        claimed: json.claimed || json.rows || [],
        claimable: json.claimable || [],
        sold: json.sold || [],
        holdsAnsem: Boolean(json.holdsAnsem),
        totalUsd: json.totalUsd,
        wallet: json.wallet || wallet.trim(),
        knownLaunch: Boolean(json.knownLaunch),
      });
    } catch (err) {
      setLedger(null);
      setError(err instanceof Error ? err.message : "Couldn't read that wallet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <section className="hero-banner hero-banner--open hero-banner--airdrop overflow-hidden border border-border">
          <div className="hero-banner__art" aria-hidden>
            <Image
              src="/brand/airdrop-hero.png"
              alt=""
              fill
              priority
              quality={90}
              sizes="(max-width: 1400px) 100vw, 1400px"
              className="hero-banner__still"
            />
          </div>
          <div className="hero-banner__copy max-w-[34rem] px-5 py-4 lg:px-7 lg:py-5">
            <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <PageBack href="/" />
              <span>Unofficial · not ansem.io</span>
            </p>
            <h1 className="display display-title mt-3 text-balance text-ink">Airdrop P&L</h1>
            <p className="mt-4 max-w-[36rem] text-pretty text-sm text-muted">
              This is not ansem.io’s claim page. Paste a Solana wallet to see what that wallet already got from launches
              on this board. Tokens in the wallet are claimed. An empty token account means claimed then sold. No account
              at all, while this wallet holds $ANSEM, is treated as still claimable. Claiming still happens on ansem.io.
            </p>
          </div>
        </section>
        <form
          className="mt-6 flex max-w-[40rem] flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Wallet address"
            className="h-11 min-w-0 flex-1 border border-input-border bg-input px-3 font-mono text-base text-ink sm:text-[13px]"
          />
          <button
            type="submit"
            disabled={loading || !wallet.trim()}
            className="type-btn h-11 border border-accent bg-accent px-4 font-semibold text-void disabled:opacity-40"
          >
            <ScrambleText text={loading ? "Reading…" : "Check"} />
          </button>
        </form>
        <Reveal show={!!error}>
          <p className="mt-3 text-sm text-bad">{error}</p>
        </Reveal>

        <Reveal show={!!ledger}>
          {ledger ? (
          <section className="mt-8 border-t border-border pt-6">
            <p className="font-mono text-sm tabular-nums text-ink">
              <LiveNum value={ledger.totalUsd} format={fmtUsd} reel /> in wallet ·{" "}
              <LiveNum value={ledger.claimed.length} format={fmtInt} reel /> held ·{" "}
              <LiveNum value={ledger.claimable.length} format={fmtInt} reel /> claimable ·{" "}
              <LiveNum value={ledger.sold.length} format={fmtInt} reel /> sold
            </p>
            <p className="mt-2 font-mono text-xs text-dim">
              <span className="break-all">{ledger.wallet}</span>
              <CopyAddr value={ledger.wallet} label="wallet address" className="ml-1" />
            </p>
            <p className="mt-2 max-w-[40rem] text-pretty text-[12.5px] text-dim">
              {ledger.holdsAnsem
                ? "This wallet holds $ANSEM, so empty rows may still be claimable on ansem.io."
                : "This wallet holds no $ANSEM, so we only list coins already in the wallet."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AnsemCta href={ANSEM_AIRDROP} primary>
                Claim on ansem.io
              </AnsemCta>
              {ledger.knownLaunch ? (
                <Link
                  href={`/wallets/${ledger.wallet}`}
                  className="type-btn inline-flex h-8 items-center border border-border px-3 text-muted hover:text-ink"
                >
                  <ScrambleText text="Launch wallet" />
                </Link>
              ) : null}
            </div>

            <HoldTable title="In wallet" rows={ledger.claimed} empty="No board airdrops in this wallet." />
            <HoldTable
              title="Still claimable"
              rows={ledger.claimable}
              empty={
                ledger.holdsAnsem
                  ? "Every airdropped board coin already has a token account here."
                  : "Hold $ANSEM in this wallet to see coins that may still be claimable."
              }
            />
            <HoldTable
              title="Claimed then sold"
              rows={ledger.sold}
              empty="No emptied token accounts for board airdrops."
            />
          </section>
          ) : null}
        </Reveal>
      </main>
    </div>
  );
}

function HoldTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: HoldingRow[];
  empty: string;
}) {
  return (
    <div className="mt-8">
      <h2 className="type-eyebrow">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-3 divide-y divide-border border-t border-border">
          {rows.map((r) => (
            <li key={r.mint} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Link href={`/c/${r.mint}`} aria-hidden tabIndex={-1} className="shrink-0">
                    <CoinThumb src={r.imageUrl} label={r.ticker || r.name} />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <Link href={`/c/${r.mint}`} className="min-w-0 truncate text-sm text-ink hover:text-gold-lit">
                        <ScrambleText text={r.name} />
                      </Link>
                      <CopyAddr value={r.mint} label="mint address" />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-dim">
                      {r.ticker ? `$${r.ticker}` : shortAddr(r.mint)} · {statusLabel(r)}
                    </p>
                  </div>
                </div>
                <a
                  href={ansemCoinUrl(r.slug) || ANSEM_AIRDROP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-btn inline-flex h-8 items-center border border-border px-3 text-muted hover:text-ink"
                >
                  <ScrambleText text={r.status === "claimable" ? "Claim" : "Open"} />
                </a>
              </div>
              <MiniStatGrid className="sm:grid-cols-3">
                <MiniStat k="Amount" v={r.amount > 0 ? <LiveNum value={r.amount} format={fmtCompact} /> : "—"} />
                <MiniStat k="Price" v={<LiveNum value={r.priceUsd} format={fmtPrice} />} />
                <MiniStat
                  k="Value"
                  v={r.status === "in_wallet" ? <LiveNum value={r.valueUsd} format={fmtUsd} /> : "—"}
                />
              </MiniStatGrid>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function statusLabel(row: HoldingRow) {
  if (row.status === "in_wallet") return "in wallet";
  if (row.status === "sold") return "sold";
  return "unclaimed";
}
