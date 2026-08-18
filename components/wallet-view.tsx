"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CoinThumb } from "@/components/coin-thumb";
import { CopyAddr } from "@/components/copy-addr";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum, LiveShift, type LiveNumFormatName } from "@/components/live-num";
import { MiniStat, MiniStatGrid, changeClass } from "@/components/mini-stat";
import { PageBack } from "@/components/page-back";
import { ScrambleText } from "@/components/scramble-text";
import { SiteHeader } from "@/components/site-header";
import { TapeStrip } from "@/components/tape-strip";
import { TimeAgo } from "@/components/time-ago";
import { useBoardPoll } from "@/components/use-board-poll";
import { WalletActions } from "@/components/wallet-actions";
import { cn } from "@/lib/cn";
import { launchStatusLabel, shortAddr } from "@/lib/format";
import { solscanAccount } from "@/lib/links";
import type { BoardResponse } from "@/lib/types";
import type { WalletPayload } from "@/lib/wallet";
import { findWallet, serialLabel, walletAirdropUsd, walletBestOfficial, type WalletCoin, type WalletRow } from "@/lib/wallets";

export function WalletView({ initial }: { initial: WalletPayload }) {
  const [row, setRow] = useState<WalletRow>(initial.row);
  const [tape, setTape] = useState(initial.tape);
  const onBoard = useCallback(
    (board: BoardResponse) => {
      const next = findWallet(board.projects, initial.row.wallet);
      if (next) setRow(next);
      const mints = new Set((next || initial.row).coins.map((c) => c.mint));
      setTape((board.tape || []).filter((event) => mints.has(event.mint)));
    },
    [initial.row],
  );
  useBoardPoll(onBoard);
  const { burn } = initial;
  const bestOfficial = walletBestOfficial(row);
  const airdropped = walletAirdropUsd(row);

  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <PageBack href="/wallets" />
          <span>
            <Link href="/wallets" className="text-muted hover:text-ink">
              <ScrambleText text="Wallets" />
            </Link>
            <span className="text-dim"> / launch wallet</span>
          </span>
        </p>
        <div className="mt-4 flex min-w-0 flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-1 flex shrink-0 items-center" aria-hidden>
              {row.coins.slice(0, 4).map((c, i) => (
                <span key={c.mint} className={cn(i > 0 && "-ml-1.5")}>
                  <CoinThumb src={c.imageUrl} label={c.ticker || c.name} />
                </span>
              ))}
            </span>
            <div className="min-w-0">
              <h1 className="display display-title text-balance text-ink">{shortAddr(row.wallet)}</h1>
              <p className="mt-2 font-mono text-xs text-dim">
                <span className="break-all">{row.wallet}</span>
                <CopyAddr value={row.wallet} label="wallet address" className="ml-1" />
              </p>
              <p className="mt-2 text-pretty text-sm text-muted">
                {row.topTier} ·{" "}
                <LiveNum value={row.coins.length} format={(n) => serialLabel(Math.round(n ?? 0))} flash={false} />
                {row.serial ? (
                  <span className={row.serial === "bad" ? "ml-2 text-bad" : "ml-2 text-gold-lit"}>serial</span>
                ) : null}
              </p>
            </div>
          </div>
          <a
            href={solscanAccount(row.wallet)}
            target="_blank"
            rel="noopener noreferrer"
            className="type-btn grid h-8 place-items-center border border-border px-3 text-muted hover:text-ink"
          >
            <ScrambleText text="Solscan" />
          </a>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          <Stat k="Launches" value={row.coins.length} format="int" />
          <Stat k="Burned" value={row.burned} format="compact" />
          <Stat k="Airdrop" value={airdropped || null} format="usd" />
          <Stat k="Listed" value={bestOfficial} format="rank" />
        </dl>

        <section className="mt-8 border-t border-border pt-6">
          <h2 className="type-eyebrow">On-chain</h2>
          <p className="mt-3 font-mono text-xs text-muted">
            {burn?.txChecked != null ? (
              <>
                <LiveNum value={burn.txChecked} format="int" flash={false} /> tx scanned
              </>
            ) : (
              "Burns not scanned yet"
            )}
            {burn?.exhausted ? " · history exhausted" : ""}
            {burn?.scannedAt ? <TimeAgo at={burn.scannedAt} prefix=" · scanned " /> : null}
          </p>
          <div className="mt-4">
            <WalletActions wallet={row.wallet} exhausted={burn?.exhausted} />
          </div>
        </section>

        <section className="mt-8 border-t border-border pt-6">
          <h2 className="type-eyebrow">Launches</h2>
          <ol className="mt-4 divide-y divide-border border-t border-border">
            {row.coins.map((c) => {
              const flags = (c.flags || []).filter((f) => f.id !== "serial");
              const status = launchStatusLabel(c.status);
              return (
                <li key={c.mint} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Link href={`/c/${c.mint}`} aria-hidden tabIndex={-1} className="shrink-0">
                        <CoinThumb src={c.imageUrl} label={c.ticker || c.name} />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1">
                          <Link href={`/c/${c.mint}`} className="min-w-0 truncate text-sm text-ink hover:text-gold-lit">
                            <ScrambleText text={c.name} />
                          </Link>
                          <CopyAddr value={c.mint} label="mint address" />
                          {c.boostPoints > 0 ? (
                            <span
                              className={cn(
                                "inline-flex h-[17px] shrink-0 items-center rounded-[5px] px-1.5 font-mono text-[8.5px] font-semibold uppercase leading-none text-void",
                                c.boostGolden ? "bg-diamond" : "bg-accent-soft",
                              )}
                            >
                              boost <LiveNum value={c.boostPoints} format="int" flash={false} className="ml-0.5" />
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-dim">
                          {c.ticker ? `$${c.ticker}` : shortAddr(c.mint)} · {c.tier}
                          {status ? ` · ${status}` : ""}
                          {c.addedAt ? <TimeAgo at={c.addedAt} prefix=" · listed " /> : null}
                        </p>
                      </div>
                    </div>
                    {flags.length > 0 ? <FlagChips flags={flags} compact /> : null}
                  </div>
                  <MiniStatGrid>
                    <MiniStat k="Mcap" v={<LiveNum value={c.marketCap} format="usd" />} />
                    <MiniStat k="Airdrop" v={<LiveNum value={c.airdropMcap} format="usd" />} />
                    <MiniStat
                      k="24h"
                      v={<LiveNum value={c.change24h} format="pct" flash={false} />}
                      className={changeClass(c.change24h)}
                    />
                    <MiniStat k="Score" v={<LiveNum value={c.score} format="usd" />} />
                    <MiniStat k="Listed" v={<OfficialRank coin={c} />} />
                    <MiniStat k="Burned" v={<LiveNum value={c.burned} format="compact" />} />
                  </MiniStatGrid>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-6 flex min-h-[var(--ticker-h)] items-center border-y border-border">
          <h2 className="type-eyebrow flex h-full shrink-0 items-center pr-2 leading-none sm:pr-3">Tape</h2>
          <TapeStrip events={tape} />
        </section>
      </main>
    </div>
  );
}

function Stat({
  k,
  value,
  format,
}: {
  k: string;
  value: number | null | undefined;
  format: LiveNumFormatName;
}) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow">{k}</dt>
      <dd className="mt-1 truncate font-mono text-lg tabular-nums text-ink">
        <LiveNum value={value} format={format} reel />
      </dd>
    </div>
  );
}

function OfficialRank({ coin }: { coin: WalletCoin }) {
  if (coin.officialRank == null) return "—";
  return (
    <>
      <LiveNum value={coin.officialRank} format="rank" flash={false} />
      {coin.officialDelta != null && coin.officialDelta !== 0 ? (
        <span className="ml-1">
          <LiveShift value={coin.officialDelta} />
        </span>
      ) : null}
    </>
  );
}
