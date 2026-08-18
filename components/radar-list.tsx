"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AnsemCta } from "@/components/ansem-cta";
import { CoinThumb } from "@/components/coin-thumb";
import { CopyAddr } from "@/components/copy-addr";
import { LiveNum } from "@/components/live-num";
import { MiniStat, MiniStatGrid } from "@/components/mini-stat";
import { ScrambleText } from "@/components/scramble-text";
import { useBoardPoll } from "@/components/use-board-poll";
import { cn } from "@/lib/cn";
import { fmtCompact } from "@/lib/format";
import { paidRadar, radarStats, type RadarReason, type RadarReasonId, type RadarRow, type RadarStats } from "@/lib/paid-radar";
import type { BoardResponse } from "@/lib/types";

const FEEDS = [
  { id: "all", label: "All" },
  { id: "burn", label: "Burn gap" },
  { id: "mismatch", label: "≠ create" },
  { id: "serial", label: "Serial" },
  { id: "sniper", label: "Bundle" },
] as const;

type RadarFeed = (typeof FEEDS)[number]["id"];

const TIER_BADGE: Record<string, string> = {
  Gold: "border-gold-lit text-gold-lit",
  Diamond: "border-diamond text-diamond",
};

function hasReason(row: RadarRow, id: RadarReasonId) {
  return row.reasons.some((r) => r.id === id);
}

function matchesFeed(row: RadarRow, feed: RadarFeed) {
  if (feed === "all") return true;
  if (feed === "burn") return hasReason(row, "pending") || hasReason(row, "partial") || hasReason(row, "short");
  return hasReason(row, feed);
}

export function RadarList({ initial, stats: initialStats }: { initial: RadarRow[]; stats: RadarStats }) {
  const [rows, setRows] = useState(initial);
  const [stats, setStats] = useState(initialStats);
  const [feed, setFeed] = useState<RadarFeed>("all");
  const onBoard = useCallback((board: BoardResponse) => {
    const next = paidRadar(board.projects);
    setRows(next);
    setStats(radarStats(board.projects, next));
  }, []);
  useBoardPoll(onBoard);

  const shown = useMemo(() => rows.filter((row) => matchesFeed(row, feed)), [rows, feed]);

  if (stats.paid === 0) {
    return (
      <div className="mt-8">
        <p className="text-pretty text-sm text-muted">No Gold or Diamond listings on this board yet.</p>
        <Link
          href="/"
          className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void"
        >
          <ScrambleText text="Open the board" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <MiniStatGrid className="mt-8 border-t border-border pt-6">
        <MiniStat k="Paid" v={<LiveNum value={stats.paid} format="int" flash={false} />} />
        <MiniStat k="Flagged" v={<LiveNum value={stats.flagged} format="int" flash={false} />} />
        <MiniStat k="Burn gap" v={<LiveNum value={stats.burnGaps} format="int" flash={false} />} />
        <MiniStat k="≠ create" v={<LiveNum value={stats.mismatch} format="int" flash={false} />} />
        <MiniStat k="Serial" v={<LiveNum value={stats.serial} format="int" flash={false} />} />
        <MiniStat k="Bundle" v={<LiveNum value={stats.sniper} format="int" flash={false} />} />
      </MiniStatGrid>

      <div className="chip-scroll mt-6 border-b border-border pb-3">
        <div className="chip-scroll__row">
        {FEEDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFeed(f.id)}
            className={cn(
              "type-btn inline-flex h-9 shrink-0 items-center whitespace-nowrap border px-3 sm:h-[30px]",
              feed === f.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:border-gold hover:text-gold-lit",
            )}
          >
            <ScrambleText text={f.label} />
          </button>
        ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 border border-dashed border-border px-5 py-14 text-center sm:px-8 sm:py-16">
          <p className="text-pretty text-sm text-muted">
            {feed === "all" ? "No Gold or Diamond flags right now." : "Nothing on this list matches that."}
          </p>
          {feed === "all" ? (
            <Link
              href="/"
              className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void"
            >
              <ScrambleText text="Open the board" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setFeed("all")}
              className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void"
            >
              <ScrambleText text="Show all flags" />
            </button>
          )}
        </div>
      ) : (
        <ol className="mt-2 divide-y divide-border border-t border-border">
          {shown.map((row, i) => (
            <RadarRowItem key={row.mint} row={row} rank={i + 1} />
          ))}
        </ol>
      )}
    </>
  );
}

function RadarRowItem({ row, rank }: { row: RadarRow; rank: number }) {
  return (
    <li className="board-card -mx-2 px-2 py-4 hover:bg-row sm:-mx-3 sm:px-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="w-6 shrink-0 pt-2 font-mono text-[11px] tabular-nums text-dim">
            <LiveNum value={rank} format="int" flash={false} />
          </span>
          <Link href={`/c/${row.mint}`} aria-hidden tabIndex={-1} className="shrink-0">
            <CoinThumb src={row.imageUrl} label={row.ticker || row.name} />
          </Link>
          <div className="min-w-0 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link href={`/c/${row.mint}`} className="truncate text-sm text-ink hover:text-gold-lit">
                {row.name}
              </Link>
              <CopyAddr value={row.mint} label="mint address" />
              {row.ticker ? <span className="font-mono text-[11px] text-dim">${row.ticker}</span> : null}
              <span
                className={cn(
                  "inline-flex h-[17px] items-center border px-1.5 font-mono text-[8.5px] font-semibold uppercase leading-none",
                  TIER_BADGE[row.tier],
                )}
              >
                {row.tier}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-muted">
              <LiveNum value={row.verifiedBurn} format={fmtCompact} flash={false} />
              {" / "}
              <LiveNum value={row.floor} format={fmtCompact} flash={false} /> $ANSEM
              {row.officialRank != null ? (
                <>
                  {" · listed "}
                  <LiveNum value={row.officialRank} format="rank" flash={false} />
                </>
              ) : null}
            </p>
            <ul className="mt-2 flex max-w-full flex-wrap gap-1">
              {row.reasons.map((reason) => (
                <li key={reason.id}>
                  <ReasonChip reason={reason} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.ansemUrl ? (
            <AnsemCta href={row.ansemUrl} primary>
              Open on ansem.io
            </AnsemCta>
          ) : null}
          <Link
            href={`/c/${row.mint}`}
            className="type-btn inline-flex h-9 items-center border border-border px-3 text-muted hover:text-ink sm:h-8"
          >
            <ScrambleText text="Scorecard" />
          </Link>
        </div>
      </div>
    </li>
  );
}

function ReasonChip({ reason }: { reason: RadarReason }) {
  return (
    <span
      className={cn(
        "inline-flex h-[17px] max-w-full items-center truncate border px-1.5 font-mono text-[8.5px] font-semibold uppercase leading-none",
        reason.severity === "bad" ? "border-bad-deep text-bad-lit" : "border-gold text-gold-lit",
      )}
    >
      {reason.label}
    </span>
  );
}
