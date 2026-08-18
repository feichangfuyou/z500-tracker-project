"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CoinThumb } from "@/components/coin-thumb";
import { CopyAddr } from "@/components/copy-addr";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum } from "@/components/live-num";
import { MiniStat, MiniStatGrid } from "@/components/mini-stat";
import { ScrambleText } from "@/components/scramble-text";
import { useBoardPoll } from "@/components/use-board-poll";
import { cn } from "@/lib/cn";
import { shortAddr } from "@/lib/format";
import type { BoardResponse } from "@/lib/types";
import {
  launchWallets,
  serialLabel,
  walletAirdropUsd,
  walletBestOfficial,
  walletLedger,
  walletMismatchCount,
  type WalletCoin,
  type WalletRow,
} from "@/lib/wallets";

const PAGE = 20;

const FEEDS = [
  { id: "all", label: "All" },
  { id: "serial", label: "Serial" },
  { id: "Diamond", label: "Diamond" },
  { id: "Gold", label: "Gold" },
  { id: "mismatch", label: "≠ create" },
] as const;

type WalletFeed = (typeof FEEDS)[number]["id"];
type SortKey = "tier" | "launches" | "burned" | "airdrop";

const TIER_BADGE: Record<string, string> = {
  Bronze: "border-bronze-lit text-bronze-lit",
  Gold: "border-gold-lit text-gold-lit",
  Diamond: "border-diamond text-diamond",
};

export function WalletList({ initial }: { initial: WalletRow[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [feed, setFeed] = useState<WalletFeed>("all");
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [page, setPage] = useState(1);
  const onBoard = useCallback((board: BoardResponse) => {
    setRows(launchWallets(board.projects));
  }, []);
  useBoardPoll(onBoard);
  const ledger = walletLedger(rows);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((row) => matchesFeed(row, feed) && matchesQuery(row, q));
    return sortRows(next, sortKey);
  }, [rows, query, feed, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * PAGE, currentPage * PAGE);
  const rankStart = (currentPage - 1) * PAGE;

  if (rows.length === 0) {
    return (
      <div className="mt-8">
        <p className="text-pretty text-sm text-muted">No launch wallets on the board yet.</p>
        <Link href="/" className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void">
          <ScrambleText text="Open the board" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
        <LedgerStat k="Wallets" value={ledger.wallets} />
        <LedgerStat k="Launches" value={ledger.launches} />
        <LedgerStat k="Serial" value={ledger.serial} />
        <LedgerStat k="Diamond" value={ledger.diamond} />
      </dl>

      <div className="mt-6 border-b border-border pb-3">
        <label className="search mb-3 flex w-full max-w-none sm:max-w-[28rem]">
          <span className="sr-only">Search wallets</span>
          <Search size={13} className="shrink-0 text-dim" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search wallet, ticker, or name"
            className="min-w-0 flex-1 bg-transparent font-mono text-base text-ink outline-none sm:text-[11px]"
          />
        </label>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="chip-scroll min-w-0 flex-1">
            {FEEDS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFeed(f.id);
                  setPage(1);
                }}
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
          <div className="flex h-9 w-full shrink-0 items-center border border-border p-[3px] sm:ml-auto sm:h-[31px] sm:w-auto">
            <SortBtn id="launches" current={sortKey} onPick={setSortKey} onPage={setPage}>
              Launches
            </SortBtn>
            <SortBtn id="burned" current={sortKey} onPick={setSortKey} onPage={setPage}>
              Burned
            </SortBtn>
            <SortBtn id="airdrop" current={sortKey} onPick={setSortKey} onPage={setPage}>
              Airdrop
            </SortBtn>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 border border-dashed border-border px-5 py-14 text-center sm:px-8 sm:py-16">
          <p className="text-pretty text-sm text-muted">Nothing on this list matches that.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFeed("all");
              setSortKey("tier");
              setPage(1);
            }}
            className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void"
          >
            <ScrambleText text="Clear filters" />
          </button>
        </div>
      ) : (
        <>
          <ol className="mt-2 divide-y divide-border border-t border-border">
            {shown.map((row, i) => (
              <WalletRowItem key={row.wallet} row={row} rank={rankStart + i + 1} />
            ))}
          </ol>
          {pageCount > 1 ? (
            <Pager
              page={currentPage}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE}
              onPage={setPage}
            />
          ) : (
            <p className="mt-6 font-mono text-[10.5px] tabular-nums text-dim">
              <LiveNum value={filtered.length} format="int" flash={false} /> wallet
              {filtered.length === 1 ? "" : "s"}
            </p>
          )}
        </>
      )}
    </>
  );
}

function WalletRowItem({ row, rank }: { row: WalletRow; rank: number }) {
  const mismatches = walletMismatchCount(row);
  const serialFlag = row.serial
    ? [{ id: "serial" as const, label: serialLabel(row.coins.length), severity: row.serial }]
    : [];
  const preview = row.coins.slice(0, 4);
  const extra = row.coins.length - preview.length;
  return (
    <li className="board-card -mx-2 px-2 py-4 hover:bg-row sm:-mx-3 sm:px-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="w-6 shrink-0 pt-2 font-mono text-[11px] tabular-nums text-dim">
            <LiveNum value={rank} format="int" flash={false} />
          </span>
          <Link href={`/wallets/${row.wallet}`} aria-hidden tabIndex={-1} className="shrink-0">
            <CoinStack coins={preview} extra={extra} />
          </Link>
          <div className="min-w-0 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                href={`/wallets/${row.wallet}`}
                aria-label={`Launch wallet ${row.wallet}`}
                className="truncate font-mono text-sm text-ink hover:text-gold-lit"
              >
                {shortAddr(row.wallet)}
              </Link>
              <CopyAddr value={row.wallet} label="wallet address" />
              <TierBadge tier={row.topTier} />
            </div>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-dim">
              {preview.map((c) => (
                <Link key={c.mint} href={`/c/${c.mint}`} className="truncate hover:text-ink">
                  <ScrambleText text={c.ticker ? `$${c.ticker}` : c.name} />
                </Link>
              ))}
              {extra > 0 ? <span className="tabular-nums">+{extra}</span> : null}
            </p>
          </div>
        </div>
        {serialFlag.length > 0 ? <FlagChips flags={serialFlag} compact walletHref={row.wallet} /> : null}
      </div>
      <MiniStatGrid className="pl-9 sm:grid-cols-5">
        <MiniStat k="Launches" v={<LiveNum value={row.coins.length} format="int" />} />
        <MiniStat k="Burned" v={<LiveNum value={row.burned} format="compact" />} />
        <MiniStat k="Airdrop" v={<LiveNum value={walletAirdropUsd(row) || null} format="usd" />} />
          <MiniStat k="Listed" v={<LiveNum value={walletBestOfficial(row)} format="rank" />} />
        <MiniStat
          k="≠ create"
          v={<LiveNum value={mismatches || null} format="int" flash={false} />}
          className={mismatches ? "text-gold-lit" : "text-dim"}
        />
      </MiniStatGrid>
    </li>
  );
}

function CoinStack({ coins, extra }: { coins: WalletCoin[]; extra: number }) {
  return (
    <span className="flex shrink-0 items-center pt-0.5" aria-hidden>
      {coins.map((c, i) => (
        <span key={c.mint} className={cn("relative", i > 0 && "-ml-1.5")}>
          <CoinThumb src={c.imageUrl} label={c.ticker || c.name} />
        </span>
      ))}
      {extra > 0 ? (
        <span className="relative -ml-1.5 grid size-8 place-items-center border border-border bg-raised font-mono text-[10px] tabular-nums text-dim">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[17px] shrink-0 items-center whitespace-nowrap rounded-[5px] border border-border bg-raised px-1.5 font-mono text-[8.5px] font-semibold uppercase leading-none text-ink",
        TIER_BADGE[tier],
      )}
    >
      {tier}
    </span>
  );
}

function LedgerStat({ k, value }: { k: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow">{k}</dt>
      <dd className="mt-1 truncate font-mono text-lg tabular-nums text-ink">
        <LiveNum value={value} format="int" reel />
      </dd>
    </div>
  );
}

function SortBtn({
  id,
  current,
  onPick,
  onPage,
  children,
}: {
  id: SortKey;
  current: SortKey;
  onPick: (key: SortKey) => void;
  onPage: (n: number) => void;
  children: string;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={() => {
        onPick(active ? "tier" : id);
        onPage(1);
      }}
      className={cn(
        "type-btn h-full min-h-0 flex-1 whitespace-nowrap px-3 sm:flex-none",
        active ? "bg-accent text-void" : "text-muted hover:text-ink",
      )}
    >
      <ScrambleText text={children} />
    </button>
  );
}

function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (n: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Wallet pages" className="mt-6 flex flex-col items-center gap-3">
      <p className="font-mono text-[10.5px] tabular-nums text-dim">
        <LiveNum value={start} format="int" flash={false} />
        –
        <LiveNum value={end} format="int" flash={false} /> of{" "}
        <LiveNum value={total} format="int" flash={false} />
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="type-btn inline-flex size-8 items-center justify-center border border-border bg-panel text-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="type-btn inline-flex size-8 items-center justify-center border border-border bg-panel text-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}

function matchesFeed(row: WalletRow, feed: WalletFeed) {
  if (feed === "all") return true;
  if (feed === "serial") return Boolean(row.serial);
  if (feed === "mismatch") return walletMismatchCount(row) > 0;
  return row.topTier === feed;
}

function matchesQuery(row: WalletRow, q: string) {
  if (!q) return true;
  if (row.wallet.toLowerCase().includes(q)) return true;
  if (row.topTier.toLowerCase().includes(q)) return true;
  return row.coins.some(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.ticker || "").toLowerCase().includes(q) ||
      c.mint.toLowerCase().includes(q),
  );
}

function sortRows(rows: WalletRow[], key: SortKey) {
  if (key === "tier") return rows;
  const copy = [...rows];
  if (key === "launches") {
    copy.sort((a, b) => b.coins.length - a.coins.length || b.burned - a.burned);
  } else if (key === "burned") {
    copy.sort((a, b) => b.burned - a.burned || b.coins.length - a.coins.length);
  } else {
    copy.sort((a, b) => walletAirdropUsd(b) - walletAirdropUsd(a) || b.coins.length - a.coins.length);
  }
  return copy;
}
