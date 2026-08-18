"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum } from "@/components/live-num";
import { MiniStat, MiniStatGrid } from "@/components/mini-stat";
import { useBoardPoll } from "@/components/use-board-poll";
import { shortAddr } from "@/lib/format";
import type { BoardResponse } from "@/lib/types";
import {
  launchWallets,
  serialLabel,
  walletAirdropUsd,
  walletBestOfficial,
  walletMismatchCount,
  type WalletRow,
} from "@/lib/wallets";

export function WalletList({ initial }: { initial: WalletRow[] }) {
  const [rows, setRows] = useState(initial);
  const onBoard = useCallback((board: BoardResponse) => {
    setRows(launchWallets(board.projects));
  }, []);
  useBoardPoll(onBoard);

  if (rows.length === 0) {
    return (
      <div className="mt-8">
        <p className="text-sm text-muted">No launch wallets on the board yet.</p>
        <Link href="/" className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void">
          Open the board
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-border border-t border-border">
      {rows.map((row) => {
        const mismatches = walletMismatchCount(row);
        const serialFlag = row.serial
          ? [{ id: "serial" as const, label: serialLabel(row.coins.length), severity: row.serial }]
          : [];
        return (
          <li key={row.wallet} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/wallets/${row.wallet}`}
                  aria-label={`Launch wallet ${row.wallet}`}
                  className="font-mono text-sm text-ink hover:text-gold-lit"
                >
                  {shortAddr(row.wallet)}
                </Link>
                <p className="mt-1 truncate text-[12.5px] text-muted">
                  {row.topTier}
                  {row.coins.slice(0, 3).map((c) => (
                    <Link key={c.mint} href={`/c/${c.mint}`} className="ml-2 hover:text-ink">
                      {c.ticker ? `$${c.ticker}` : c.name}
                    </Link>
                  ))}
                </p>
              </div>
              {serialFlag.length > 0 ? <FlagChips flags={serialFlag} compact walletHref={row.wallet} /> : null}
            </div>
            <MiniStatGrid className="sm:grid-cols-5">
              <MiniStat k="Launches" v={<LiveNum value={row.coins.length} format="int" />} />
              <MiniStat k="Burned" v={<LiveNum value={row.burned} format="compact" />} />
              <MiniStat k="Airdrop" v={<LiveNum value={walletAirdropUsd(row) || null} format="usd" />} />
              <MiniStat k="Official" v={<LiveNum value={walletBestOfficial(row)} format="rank" />} />
              <MiniStat
                k="Mismatch"
                v={<LiveNum value={mismatches || null} format="int" flash={false} />}
                className={mismatches ? "text-bad" : "text-dim"}
              />
            </MiniStatGrid>
          </li>
        );
      })}
    </ul>
  );
}
