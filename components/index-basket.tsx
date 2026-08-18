"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CoinThumb } from "@/components/coin-thumb";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum } from "@/components/live-num";
import { MiniStat, MiniStatGrid, changeClass } from "@/components/mini-stat";
import { ScrambleText } from "@/components/scramble-text";
import { useBoardPoll } from "@/components/use-board-poll";
import { cn } from "@/lib/cn";
import { launchStatusLabel } from "@/lib/format";
import { indexFromProjects, overlayLiveIndex, utcDayLabel } from "@/lib/index-day";
import type { BoardResponse, IndexDay } from "@/lib/types";

export function IndexBasket({
  snapshot,
  liveDay,
  days,
}: {
  snapshot: IndexDay;
  liveDay: IndexDay | null;
  days: IndexDay[];
}) {
  const [live, setLive] = useState(liveDay);
  const onBoard = useCallback((board: BoardResponse) => {
    setLive(indexFromProjects(board.projects));
  }, []);
  useBoardPoll(onBoard);
  const latest = overlayLiveIndex(snapshot, live ? { ...live, at: snapshot.at } : live);

  return (
    <>
      {days.length > 1 ? (
        <nav className="mt-6 flex flex-wrap gap-1" aria-label="Snapshot days">
          {days.map((day) => (
            <Link
              key={day.at}
              href={`/index?d=${day.at}`}
              className={cn(
                "type-btn h-8 border px-3 font-mono text-[11px] tabular-nums",
                day.at === latest.at ? "border-accent text-accent" : "border-border text-muted hover:text-ink",
              )}
            >
              {utcDayLabel(day.at)}
            </Link>
          ))}
        </nav>
      ) : null}
      <p className="mt-4 font-mono text-[11px] tabular-nums text-dim">{utcDayLabel(latest.at)} UTC</p>
      <ol className="mt-4 divide-y divide-border border-t border-border">
        {latest.coins.map((c, i) => {
          const status = launchStatusLabel(c.status);
          return (
            <li key={c.mint} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/c/${c.mint}`} className="flex min-w-0 items-center gap-2.5 hover:text-gold-lit">
                  <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-dim">
                    <LiveNum value={i + 1} format="int" flash={false} />
                  </span>
                  <CoinThumb src={c.imageUrl} label={c.ticker || c.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">
                      <ScrambleText text={c.name} />
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-dim">
                      {[c.ticker ? `$${c.ticker}` : null, c.tier, status].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
                {(c.flags || []).length > 0 ? <FlagChips flags={c.flags || []} compact /> : null}
              </div>
              <MiniStatGrid>
                <MiniStat k="Score" v={<LiveNum value={c.score} format="usd" />} />
                <MiniStat k="Listed" v={<LiveNum value={c.officialRank} format="rank" />} />
                <MiniStat k="Airdrop" v={<LiveNum value={c.airdropMcap} format="usd" />} />
                <MiniStat k="Burned" v={<LiveNum value={c.burned} format="compact" />} />
                <MiniStat k="Mcap" v={<LiveNum value={c.marketCap} format="usd" />} />
                <MiniStat
                  k="24h"
                  v={<LiveNum value={c.change24h} format="pct" flash={false} />}
                  className={changeClass(c.change24h)}
                />
              </MiniStatGrid>
            </li>
          );
        })}
      </ol>
    </>
  );
}
