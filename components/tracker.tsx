"use client";

import Image from "next/image";
import Link from "next/link";
import { CoinThumb } from "@/components/coin-thumb";
import { CopyAddr } from "@/components/copy-addr";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { BurnVideo } from "@/components/burn-hero";
import { FlagChips } from "@/components/flag-chips";
import { MiniStat, MiniStatGrid, changeClass } from "@/components/mini-stat";
import { LiveNum, LiveShift } from "@/components/live-num";
import { Reveal, Spin } from "@/components/reveal";
import { ScrambleText } from "@/components/scramble-text";
import { SiteHeader } from "@/components/site-header";
import { StatIcon, type StatIconName } from "@/components/stat-icon";
import { TapeStrip } from "@/components/tape-strip";
import { TimeAgo } from "@/components/time-ago";
import { TradeLinks } from "@/components/trade-links";
import { closedTabHint } from "@/lib/notify";
import { loadLocalWatches, loadWatchWallet, pullWatches, pushWatches, saveLocalWatches, saveWatchWallet } from "@/components/watch-sync";
import { applyBurnValue, burnAnnounce, burnIncreases, snapshotBurns, type BurnHit } from "@/lib/burn-fx";
import { cn } from "@/lib/cn";
import { fmtCompact, fmtInt, fmtNum, fmtPct, fmtPrice, fmtRank, fmtUsd, shortAddr } from "@/lib/format";
import {
  getHeaderChrome,
  getHeaderChromeServer,
  setHeaderAdd,
  setHeaderQuery,
  subscribeHeaderChrome,
} from "@/lib/header-chrome";
import { isValidAddress } from "@/lib/guardrails";
import { computeScore } from "@/lib/score";
import { projectFlags } from "@/lib/flags";
import { TIERS, type BoardResponse, type Project } from "@/lib/types";

const PAGE = 20;
const POLL_MS = 30_000;

function fmtAnsem(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n}`;
}

function paginationItems(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current]);
  for (let n = current - 1; n <= current + 1; n += 1) {
    if (n >= 1 && n <= total) set.add(n);
  }
  if (current <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (current >= total - 2) {
    set.add(total - 3);
    set.add(total - 2);
    set.add(total - 1);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev != null && n - prev > 1) items.push("gap");
    items.push(n);
  }
  return items;
}

type SortKey = "listed" | "score" | "mcap" | "change" | "burn" | "airdrop" | "boost" | "delta";
type BoardView = "grid" | "table";
type FeedFilter = "all" | "on_curve" | "migrated" | "Free" | "Bronze" | "Gold" | "Diamond" | "boosted" | "watching" | "flagged";

const VIEW_KEY = "crosscheck_board_view";

function loadBoardView(): BoardView {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "grid" || saved === "table" ? saved : "grid";
  } catch {
    return "grid";
  }
}

const FEEDS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "on_curve", label: "On curve" },
  { id: "migrated", label: "Migrated" },
  { id: "Free", label: "Free" },
  { id: "Bronze", label: "Bronze" },
  { id: "Gold", label: "Gold" },
  { id: "Diamond", label: "Diamond" },
  { id: "boosted", label: "Boosted" },
  { id: "flagged", label: "Flagged" },
  { id: "watching", label: "Watching" },
];

const FEED_COPY: Record<BoardResponse["feedSource"], string> = {
  ansem: "ansem.io",
  cache: "a saved copy",
  pump: "pump.fun",
  dex: "DexScreener",
};

function TickerPin({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null | undefined;
  format: (n: number | null | undefined) => string;
}) {
  return (
    <span className="flex h-[var(--ticker-h)] shrink-0 items-center gap-1 whitespace-nowrap border-l border-border px-2 tabular-nums sm:gap-1.5 sm:px-3.5">
      <span className="text-dim">{label}</span>
      <span className="text-ink">
        <LiveNum value={value} format={format} />
      </span>
    </span>
  );
}

function loadWatched(): string[] {
  return loadLocalWatches();
}

export function Tracker({ initial }: { initial: BoardResponse }) {
  const [board, setBoard] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { query, addOpen: showAdd } = useSyncExternalStore(subscribeHeaderChrome, getHeaderChrome, getHeaderChromeServer);
  const [feed, setFeed] = useState<FeedFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("listed");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("asc");
  const [auto, setAuto] = useState(true);
  const [watched, setWatched] = useState<string[]>([]);
  const [watchWallet, setWatchWallet] = useState("");
  const [alertsOn, setAlertsOn] = useState(false);
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [checkingHolders, setCheckingHolders] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [openMint, setOpenMint] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>("grid");
  const [formError, setFormError] = useState<string | null>(null);
  const [burnFx, setBurnFx] = useState<{ at: number; label: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    mint: "",
    tier: "Unranked",
    burnAmount: "",
    launchWallet: "",
  });
  const prevRanks = useRef<Record<string, number>>({});
  const prevImages = useRef<Record<string, string>>({});
  const prevBurns = useRef(snapshotBurns(initial.projects));
  const prevTape = useRef(new Set((initial.tape || []).map((e) => e.id)));
  if (Object.keys(prevImages.current).length === 0) {
    for (const p of initial.projects) {
      if (p.imageUrl) prevImages.current[p.mint] = p.imageUrl;
    }
  }
  if (Object.keys(prevRanks.current).length === 0) {
    [...initial.projects]
      .sort((a, b) => b.score - a.score)
      .forEach((p, i) => {
        prevRanks.current[p.id] = i;
      });
  }
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setView(loadBoardView());
    setWatched(loadWatched());
    setWatchWallet(loadWatchWallet());
    fetch("/api/session")
      .then((r) => r.json())
      .then((json: { sid?: string }) => {
        if (json.sid) setBoard((b) => ({ ...b, sid: json.sid! }));
      })
      .catch(() => undefined);
    pullWatches()
      .then(({ mints, shouldPush }) => {
        setWatched(mints);
        if (shouldPush) void pushWatches(mints);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!showAdd) return;
    requestAnimationFrame(() => addRef.current?.scrollIntoView({ block: "start" }));
  }, [showAdd]);

  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    const sync = (on: boolean) => {
      if (on) el.removeAttribute("data-off");
      else el.setAttribute("data-off", "");
    };
    const io = new IntersectionObserver(([entry]) => {
      sync(Boolean(entry?.isIntersecting) && document.visibilityState === "visible");
    });
    io.observe(el);
    const onVis = () => sync(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const persistWatch = (next: string[]) => {
    setWatched(next);
    saveLocalWatches(next);
    void pushWatches(next);
  };

  const ignite = useCallback((hits: BurnHit[]) => {
    const first = hits[0];
    if (!first) return;
    setBurnFx({ at: Date.now(), label: burnAnnounce(first) });
  }, []);

  const stopBurn = useCallback(() => setBurnFx(null), []);

  const applyDeltas = useCallback((incoming: BoardResponse) => {
    const ranked = [...incoming.projects].sort((a, b) => b.score - a.score);
    const nextRanks: Record<string, number> = {};
    ranked.forEach((p, i) => {
      nextRanks[p.id] = i;
    });
    const withDeltas = incoming.projects.map((p) => ({
      ...p,
      imageUrl: p.imageUrl || prevImages.current[p.mint] || null,
      rankDelta:
        prevRanks.current[p.id] !== undefined ? prevRanks.current[p.id] - (nextRanks[p.id] ?? 0) : 0,
    }));
    const moved = withDeltas.filter(
      (p) => watched.includes(p.mint) && p.rankDelta !== 0 && prevRanks.current[p.id] !== undefined,
    );
    prevRanks.current = nextRanks;
    for (const p of withDeltas) {
      if (p.imageUrl) prevImages.current[p.mint] = p.imageUrl;
    }
    const burned = burnIncreases(prevBurns.current, withDeltas);
    prevBurns.current = burned.next;
    if (burned.hits.length) ignite(burned.hits);
    setBoard((prev) => ({ ...incoming, projects: withDeltas, sid: incoming.sid || prev.sid }));
    const tape = incoming.tape || [];
    const freshTape = tape.filter((e) => !prevTape.current.has(e.id));
    prevTape.current = new Set(tape.map((e) => e.id));
    if (alertsOn && "Notification" in window && Notification.permission === "granted") {
      const notice =
        freshTape.find((e) => e.kind === "launch") ||
        freshTape.find((e) => e.kind === "boost") ||
        freshTape.find((e) => watched.includes(e.mint)) ||
        moved[0];
      if (notice && "label" in notice) {
        new Notification("Crosscheck", { body: notice.label });
      } else if (moved.length) {
        const first = moved[0];
        new Notification("Crosscheck", {
          body: `${first.name} moved ${first.rankDelta > 0 ? "up" : "down"} ${Math.abs(first.rankDelta)}`,
        });
      }
    }
  }, [alertsOn, ignite, watched]);

  const refresh = useCallback(async (mode: "lite" | "fresh" = "fresh") => {
    if (mode === "fresh") setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(mode === "fresh" ? "/api/board?fresh=1" : "/api/board?lite=1", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("refresh failed");
      const json = (await res.json()) as BoardResponse;
      applyDeltas(json);
    } catch {
      if (mode === "fresh") setError("Couldn't refresh live data. Check your connection and try again.");
    } finally {
      if (mode === "fresh") setRefreshing(false);
    }
  }, [applyDeltas]);

  useEffect(() => {
    if ((initial.stats.coins || 0) <= initial.projects.length) return;
    let alive = true;
    fetch("/api/board?lite=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: BoardResponse | null) => {
        if (alive && json?.projects?.length) applyDeltas(json);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [applyDeltas, initial.projects.length, initial.stats.coins]);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh("lite");
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [auto, refresh]);

  useEffect(() => {
    if (pendingDelete) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [pendingDelete]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = board.projects.filter((p) => {
      if (feed === "watching" && !watched.includes(p.mint)) return false;
      if (feed === "flagged" && !(p.flags || []).length) return false;
      if (feed === "on_curve" && (p.status || "") !== "on_curve") return false;
      if (feed === "migrated" && (p.status || "") !== "migrated") return false;
      if (feed === "boosted" && !(p.boostPoints > 0)) return false;
      if ((feed === "Free" || feed === "Bronze" || feed === "Gold" || feed === "Diamond") && p.tier !== feed) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.ticker || "").toLowerCase().includes(q) ||
        p.mint.toLowerCase().includes(q) ||
        (p.slug || "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list].sort((a, b) => {
      let av = 0;
      let bv = 0;
      switch (sortKey) {
        case "listed":
          av = a.officialRank ?? Number.POSITIVE_INFINITY;
          bv = b.officialRank ?? Number.POSITIVE_INFINITY;
          break;
        case "score":
          av = a.score;
          bv = b.score;
          break;
        case "mcap":
          av = a.live?.marketCap || 0;
          bv = b.live?.marketCap || 0;
          break;
        case "airdrop":
          av = a.live?.airdropMcap || 0;
          bv = b.live?.airdropMcap || 0;
          break;
        case "change":
          av = a.live?.change24h || 0;
          bv = b.live?.change24h || 0;
          break;
        case "burn":
          av = a.verifiedBurn ?? a.burnAmount ?? 0;
          bv = b.verifiedBurn ?? b.burnAmount ?? 0;
          break;
        case "boost":
          av = a.boostPoints || 0;
          bv = b.boostPoints || 0;
          break;
        case "delta":
          av = a.officialDelta || 0;
          bv = b.officialDelta || 0;
          break;
        default:
          break;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return sorted;
  }, [board.projects, query, feed, sortKey, sortDir, watched]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount);
  const shown = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);
  const rankStart = (safePage - 1) * PAGE;
  const movers = board.projects
    .filter((p) => p.live?.change24h != null)
    .sort((a, b) => Math.abs(b.live?.change24h || 0) - Math.abs(a.live?.change24h || 0))
    .slice(0, 24);
  const tickerTape =
    movers.length === 0
      ? []
      : Array.from({ length: Math.max(1, Math.ceil(12 / movers.length)) }, () => movers).flat();

  const toggleSort = (key: SortKey) => {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "listed" ? "asc" : "desc");
    }
  };

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), pageCount));
    document.getElementById("board")?.scrollIntoView({ block: "start" });
  };

  const setBoardView = (next: BoardView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  };

  const toggleWatch = (mint: string) => {
    persistWatch(watched.includes(mint) ? watched.filter((m) => m !== mint) : [...watched, mint]);
  };

  const enableAlerts = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setAlertsOn(perm === "granted");
  };

  const openAdd = () => {
    setHeaderAdd(true);
  };

  const addProject = async () => {
    setFormError(null);
    if (!form.name.trim() || !form.mint.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setFormError(json.error || "Couldn't add that launch.");
      return;
    }
    setForm({ name: "", mint: "", tier: "Unranked", burnAmount: "", launchWallet: "" });
    setHeaderAdd(false);
    refresh();
  };

  const verify = async (p: Project, deep = false) => {
    if (!p.launchWallet) return;
    setVerifying(p.id);
    try {
      const [burnRes, provRes] = await Promise.all([
        fetch("/api/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: p.launchWallet, deep }),
        }),
        fetch("/api/provenance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mint: p.mint, wallet: p.launchWallet }),
        }),
      ]);
      const json = await burnRes.json();
      if (!burnRes.ok) throw new Error(json.error);
      const prov = provRes.ok ? await provRes.json() : null;
      const amount = Number(json.verifiedBurn) || 0;
      const burned = applyBurnValue(prevBurns.current, p.id, amount, p.name);
      prevBurns.current = burned.next;
      if (burned.hit) ignite([burned.hit]);
      setBoard((prev) => ({
        ...prev,
        projects: prev.projects.map((row) =>
          row.id === p.id
            ? {
                ...row,
                verifiedBurn: json.verifiedBurn,
                verifiedTxChecked: json.txChecked,
                verifiedAt: json.scannedAt,
                verifyExhausted: json.exhausted,
                walletProvenance: prov?.status ?? row.walletProvenance,
                score: computeScore({
                  ...row,
                  verifiedBurn: json.verifiedBurn,
                  burnPriceRef: prev.ansemPrice || row.burnPriceRef,
                }),
              }
            : row,
        ),
      }));
    } catch {
      setError("Couldn't reach Solana RPC — try again.");
    } finally {
      setVerifying(null);
    }
  };

  const checkHolders = async (p: Project) => {
    setCheckingHolders(p.id);
    try {
      const res = await fetch("/api/holders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: p.mint }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBoard((prev) => ({
        ...prev,
        projects: prev.projects.map((row) =>
          row.id === p.id
            ? {
                ...row,
                holderTop10Pct: json.top10Pct,
                insiderPct: json.insiderPct ?? row.insiderPct,
                sniper: json.sniper ?? row.sniper,
                flags: projectFlags({
                  ...row,
                  holderTop10Pct: json.top10Pct,
                  insiderPct: json.insiderPct ?? row.insiderPct,
                  sniper: json.sniper ?? row.sniper,
                }),
              }
            : row,
        ),
      }));
    } catch {
      setError("Couldn't read holder concentration.");
    } finally {
      setCheckingHolders(null);
    }
  };

  const report = async (p: Project) => {
    const res = await fetch(`/api/projects/${p.id}/report`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Couldn't report.");
      return;
    }
    refresh();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const res = await fetch(`/api/projects/${pendingDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "Couldn't remove.");
    }
    setPendingDelete(null);
    refresh();
  };

  const patchBurn = async (p: Project, value: string) => {
    setBoard((prev) => ({
      ...prev,
      projects: prev.projects.map((row) =>
        row.id === p.id ? { ...row, burnAmount: parseFloat(value) || 0 } : row,
      ),
    }));
    await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ burnAmount: value }),
    });
  };

  const th = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <th className={cn("type-th", align === "left" ? "text-left" : "text-right")}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          "relative inline-flex w-full items-center",
          align === "right" ? "justify-end" : "justify-start",
        )}
      >
        {label}
        {sortKey === key && (
          <span className="pointer-events-none absolute left-full w-2 text-center">
            {sortDir === "desc" ? "↓" : "↑"}
          </span>
        )}
      </button>
    </th>
  );

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg pb-[calc(var(--ticker-h)+1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader>
        <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => (alertsOn ? setAlertsOn(false) : enableAlerts())}
              aria-label={alertsOn ? "Disable launch and burn alerts" : "Enable launch and burn alerts"}
              className="grid size-10 place-items-center border border-border bg-panel text-muted hover:border-border-strong hover:text-ink sm:size-[31px]"
            >
              {alertsOn ? <Bell size={13} /> : <BellOff size={13} />}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing" : "Refresh"}
              className="type-btn hidden size-[31px] items-center justify-center border border-border text-ink hover:border-border-strong md:inline-flex md:h-8 md:w-auto md:gap-2 md:px-3 disabled:opacity-40"
            >
              <motion.span
                className="inline-flex"
                animate={refreshing && !reduceMotion ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  refreshing && !reduceMotion
                    ? { repeat: Infinity, duration: 0.8, ease: "linear" }
                    : { duration: 0.2, ease: "easeOut" }
                }
              >
                <RefreshCw size={12} />
              </motion.span>
              <span className="hidden lg:inline">
                <ScrambleText text={refreshing ? "Refreshing" : "Refresh"} />
              </span>
            </button>
        </div>
      </SiteHeader>

      <p className="sr-only" aria-live="polite">
        {burnFx?.label ?? ""}
      </p>
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <section className="hero-banner overflow-hidden border border-border">
          <div className={cn("hero-banner__art", burnFx ? "hero-banner__art--live" : null)} aria-hidden>
            <Image
              src="/brand/tracker-banner.png"
              alt=""
              fill
              priority
              quality={70}
              sizes="(max-width: 900px) 100vw, 1400px"
              className="hero-banner__still"
            />
            <BurnVideo playId={burnFx?.at ?? 0} active={!!burnFx} onEnded={stopBurn} />
          </div>
          <div className="hero-banner__copy max-w-[620px] px-5 py-3 sm:py-5 lg:px-8 lg:py-7">
            <p className="type-eyebrow">Unofficial · not ansem.io</p>
            <h1 className="display display-scan display-title mt-2 text-balance text-ink sm:mt-3">
              What’s launching on ansem.io
            </h1>
            <p className="mt-2 text-pretty text-sm text-muted sm:hidden">
              Unofficial tracker of ansem.io launches — prices, verified $ANSEM burns, and flags.{" "}
              <Link href="/guide" className="text-ink hover:text-gold-lit">
                <ScrambleText text="How to read this site" />
              </Link>
              .
            </p>
            <p className="mt-5 hidden max-w-[472px] text-pretty text-sm text-muted sm:block">
              ansem.io is a Solana site where people launch new coins. Crosscheck is our unofficial tracker of those
              same coins — prices, whether $ANSEM burns actually happened, and flags when something looks off. Not the
              official z500, and not built by ansem.io.
            </p>
            <div className="mt-4 flex w-full max-w-[472px] flex-col min-[420px]:flex-row sm:mt-6">
              <Link
                href="/guide"
                className="type-btn inline-flex h-11 min-h-11 flex-1 items-center justify-center bg-accent px-3 font-semibold text-void hover:bg-accent-hover"
              >
                <ScrambleText text="Start here" />
              </Link>
              <a
                href="#board"
                className="type-btn inline-flex h-11 min-h-11 items-center justify-center border-t border-accent px-4 text-accent hover:bg-accent hover:text-void min-[420px]:border-t-0 min-[420px]:border-l"
              >
                <ScrambleText text="Open the board" />
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
          <div>
            <p className="type-eyebrow">1. ansem.io</p>
            <p className="mt-2 text-pretty text-sm text-muted">
              Coins go live there. Teams burn $ANSEM and can buy boosts to move the official z500 list. Launch, claim,
              and trade still happen on ansem.io.
            </p>
          </div>
          <div>
            <p className="type-eyebrow">2. This board</p>
            <p className="mt-2 text-pretty text-sm text-muted">
              The table below is our live list. Listed # uses public ansem.io inputs (airdrop value + boosts). Score
              adds verified burns — that is not z500.
            </p>
          </div>
          <div>
            <p className="type-eyebrow">3. Click a coin</p>
            <p className="mt-2 text-pretty text-sm text-muted">
              Open a coin for the scorecard, holders, and why a flag appeared.{" "}
              <Link href="/guide" className="text-ink hover:text-gold-lit">
                <ScrambleText text="Full guide" />
              </Link>
              .
            </p>
          </div>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-border pt-6 min-[480px]:grid-cols-2 min-[480px]:gap-x-8 lg:grid-cols-4">
          <Stat icon="rocket" k="Coins listed" value={board.stats.coins} format={fmtInt} c="Every launch we can see" />
          <Stat icon="gift" k="Airdropped" value={board.stats.airdroppedUsd} format={fmtUsd} c="Value sent to holders" />
          <Stat
            icon="flame"
            k="$ANSEM burned"
            value={board.stats.burnedAnsem}
            format={fmtCompact}
            c={
              <>
                Listed on ansem.io
                {board.stats.verifiedBurned > 0 ? (
                  <>
                    {" "}
                    · on-chain <LiveNum value={board.stats.verifiedBurned} format="compact" flash={false} />
                  </>
                ) : null}
                {board.stats.paidPending > 0 ? (
                  <>
                    {" "}
                    · {board.stats.paidPending} paid still scanning
                  </>
                ) : null}
              </>
            }
          />
          <Stat
            icon="bolt"
            k="Boosted now"
            value={board.stats.boosted}
            format={fmtInt}
            c={
              board.stats.lastScanAt ? (
                <>
                  <LiveNum value={board.stats.scannedWallets} format="compact" flash={false} /> wallets scanned
                </>
              ) : (
                "Paying for extra visibility"
              )
            }
          />
        </div>

        <section className="mt-6 border border-border bg-panel px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="type-eyebrow">Coverage</h2>
            <p className={cn("font-mono text-[11px] tabular-nums", board.stats.coverageLive ? "text-good" : "text-dim")}>
              {board.stats.coverageLive ? "Live burns" : "Cron scan"}
              {board.stats.lastBurnAt ? (
                <>
                  {" · last burn "}
                  <TimeAgo at={board.stats.lastBurnAt} />
                </>
              ) : null}
            </p>
          </div>
          <MiniStatGrid>
            <MiniStat
              k="Paid indexed"
              v={
                <>
                  <LiveNum value={board.stats.paidIndexed} format="int" flash={false} />
                  {" / "}
                  <LiveNum value={board.stats.paidWallets} format="int" flash={false} />
                </>
              }
              hint="Gold and Diamond launch wallets with an on-chain burn index"
            />
            <MiniStat
              k="Done"
              v={<LiveNum value={board.stats.paidExhausted} format="int" flash={false} />}
              hint="Paid wallets scanned to the end of history"
            />
            <MiniStat
              k="Still scanning"
              v={<LiveNum value={board.stats.paidPending} format="int" flash={false} />}
              hint="Paid wallets with no index yet"
            />
            <MiniStat
              k="Wallets"
              v={<LiveNum value={board.stats.scannedWallets} format="int" flash={false} />}
              hint="Launch wallets with at least one burn pass"
            />
            <MiniStat
              k="On-chain"
              v={<LiveNum value={board.stats.verifiedBurned} format="compact" flash={false} />}
              hint="Verified $ANSEM burned across indexed wallets"
            />
            <MiniStat
              k="Last scan"
              v={board.stats.lastScanAt ? <TimeAgo at={board.stats.lastScanAt} /> : "—"}
            />
          </MiniStatGrid>
        </section>

        <section className="mt-6 flex min-h-[var(--ticker-h)] min-w-0 items-center overflow-hidden border-y border-border">
          <h2 className="type-eyebrow flex h-full shrink-0 items-center pr-2 leading-none sm:pr-3">Tape</h2>
          <TapeStrip events={board.tape || []} />
          <p className="hidden h-full shrink-0 items-center border-l border-border bg-bg px-3 font-mono text-[11px] leading-none text-dim md:flex">
            {closedTabHint(board.alerts)}
          </p>
        </section>

        <Reveal show={!!error}>
          <div className="mt-6 border border-bad/40 bg-panel px-4 py-3 text-sm text-bad">{error}</div>
        </Reveal>
        <Reveal show={board.feedSource !== "ansem"}>
          <div className="mt-6 border border-border bg-panel px-4 py-3 text-sm text-muted">
            Could not load the live ansem.io list. Showing {FEED_COPY[board.feedSource]}. These rows are not ranked as
            listed ansem.io launches.
          </div>
        </Reveal>

        <label className="search mt-6 flex w-full max-w-none md:hidden">
          <span className="sr-only">Search</span>
          <Search size={13} className="shrink-0 text-dim" />
          <input
            value={query}
            onChange={(e) => {
              setHeaderQuery(e.target.value);
            }}
            placeholder="Search name or ticker"
            className="min-w-0 flex-1 bg-transparent font-mono text-base text-ink outline-none sm:text-[11px]"
          />
        </label>

        <div
          id="board"
          className="mt-6 scroll-mt-[calc(var(--header-h)+0.5rem)] border-b border-border pb-3"
        >
          <div className="flex w-full min-w-0 flex-col gap-3 overflow-x-clip sm:flex-row sm:items-center">
            <div className="chip-scroll min-w-0 flex-1">
              <div className="chip-scroll__row">
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
            </div>
            <div className="flex w-full shrink-0 items-center gap-2 sm:ml-auto sm:w-auto">
              <div className="flex h-9 min-w-0 flex-1 items-center border border-border p-[3px] sm:h-[31px] sm:flex-none">
                <button
                  type="button"
                  onClick={() => setAuto((v) => !v)}
                  aria-pressed={auto}
                  className={cn(
                    "type-btn inline-flex h-full min-h-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 sm:flex-none",
                    auto ? "text-accent" : "text-muted hover:text-ink",
                  )}
                >
                  {auto ? <span className="live-dot" aria-hidden /> : null}
                  <ScrambleText text="Live" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("listed")}
                  className={cn(
                    "type-btn h-full min-h-0 flex-1 whitespace-nowrap px-3 sm:flex-none",
                    sortKey === "listed" ? "bg-accent text-void" : "text-muted hover:text-ink",
                  )}
                >
                  <ScrambleText text="Listed" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("mcap")}
                  className={cn(
                    "type-btn h-full min-h-0 flex-1 whitespace-nowrap px-3 sm:flex-none",
                    sortKey === "mcap" ? "bg-accent text-void" : "text-muted hover:text-ink",
                  )}
                >
                  <ScrambleText text="Mcap" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("score")}
                  className={cn(
                    "type-btn h-full min-h-0 flex-1 whitespace-nowrap px-3 sm:flex-none",
                    sortKey === "score" ? "bg-accent text-void" : "text-muted hover:text-ink",
                  )}
                >
                  <ScrambleText text="Score" />
                </button>
              </div>
              <div className="hidden h-9 shrink-0 items-center border border-border p-[3px] md:flex md:h-[31px]">
                <button
                  type="button"
                  aria-pressed={view === "grid"}
                  aria-label="Grid view"
                  onClick={() => setBoardView("grid")}
                  className={cn(
                    "type-btn inline-flex h-full min-h-0 items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3",
                    view === "grid" ? "bg-accent text-void" : "text-muted hover:text-ink",
                  )}
                >
                  <LayoutGrid size={12} />
                  <span className="hidden min-[420px]:inline">
                    <ScrambleText text="Grid" />
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={view === "table"}
                  aria-label="Table view"
                  onClick={() => setBoardView("table")}
                  className={cn(
                    "type-btn inline-flex h-full min-h-0 items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3",
                    view === "table" ? "bg-accent text-void" : "text-muted hover:text-ink",
                  )}
                >
                  <List size={12} />
                  <span className="hidden min-[420px]:inline">
                    <ScrambleText text="Table" />
                  </span>
                </button>
              </div>
            </div>
          </div>
          <Reveal show={feed === "watching"} className="mt-3 flex min-w-0 items-center">
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const wallet = watchWallet.trim();
                if (wallet && !isValidAddress(wallet)) {
                  setError("Watch wallet looks invalid.");
                  return;
                }
                setError(null);
                saveWatchWallet(wallet);
                pullWatches(loadWatched(), wallet)
                  .then(({ mints }) => persistWatch(mints))
                  .catch(() => undefined);
              }}
            >
              <label className="search min-w-0 flex-1">
                <span className="sr-only">Watchlist wallet</span>
                <input
                  value={watchWallet}
                  onChange={(e) => setWatchWallet(e.target.value)}
                  placeholder="Paste wallet to sync watches"
                  className="min-w-0 flex-1 bg-transparent font-mono text-base text-ink outline-none sm:text-[11px]"
                />
              </label>
              <button type="submit" className="type-btn h-11 shrink-0 border border-border px-3 text-muted hover:text-ink sm:h-[30px]">
                <ScrambleText text="Sync" />
              </button>
            </form>
          </Reveal>
        </div>
        <p className="mt-3 font-mono text-[10.5px] text-dim">
          Updated <TimeAgo at={board.lastSynced} />
        </p>

        <Reveal show={showAdd}>
          <div ref={addRef} id="add" className="mt-6 border border-border bg-panel p-4 sm:p-6">
            <p className="type-eyebrow mb-1">Add a missing coin</p>
            <p className="mb-4 text-pretty text-sm text-muted">
              If a launch is not on the list yet, add it here. Everyone will see it.
            </p>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Field label="Coin name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bull's Eye"
                  className="h-11 w-full border border-input-border bg-input px-3 text-base text-ink sm:h-8 sm:text-sm"
                />
              </Field>
              <Field label="Contract address">
                <input
                  value={form.mint}
                  onChange={(e) => setForm({ ...form, mint: e.target.value })}
                  placeholder="Paste the coin contract"
                  className="h-11 w-full border border-input-border bg-input px-3 font-mono text-base text-ink sm:h-8 sm:text-[13px]"
                />
              </Field>
              <Field label="Tier">
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value })}
                  className="h-11 w-full border border-input-border bg-input px-3 text-base text-ink sm:h-8 sm:text-sm"
                >
                  {TIERS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="$ANSEM burned (optional)">
                <input
                  type="number"
                  value={form.burnAmount}
                  onChange={(e) => setForm({ ...form, burnAmount: e.target.value })}
                  placeholder="0"
                  className="h-11 w-full border border-input-border bg-input px-3 font-mono text-base tabular-nums text-ink sm:h-8 sm:text-sm"
                />
              </Field>
            </div>
            <Field label="Launch wallet (optional)">
              <input
                value={form.launchWallet}
                onChange={(e) => setForm({ ...form, launchWallet: e.target.value })}
                placeholder="Wallet that burned $ANSEM — we check this on-chain"
                className="h-11 w-full border border-input-border bg-input px-3 font-mono text-base text-ink sm:h-8 sm:text-[13px]"
              />
            </Field>
            <p className="mt-2 text-[11px] text-dim">
              Duplicate coins are rejected. Only you can edit the burn number after you add it.
            </p>
            {formError ? <p className="mt-2 text-sm text-bad">{formError}</p> : null}
            <button
              type="button"
              onClick={addProject}
              disabled={!form.name.trim() || !form.mint.trim()}
              className="type-btn mt-5 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void disabled:opacity-40"
            >
              <ScrambleText text="Add coin" />
            </button>
          </div>
        </Reveal>

        {shown.length === 0 ? (
          <div className="mt-8 border border-dashed border-border px-5 py-14 text-center sm:px-8 sm:py-16">
            <p className="text-pretty text-sm text-muted">Nothing on the list matches that.</p>
            <button
              type="button"
              onClick={() => {
                setHeaderQuery("");
                setFeed("all");
                setPage(1);
                openAdd();
              }}
              className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void"
            >
              <ScrambleText text="Add a coin" />
            </button>
          </div>
        ) : (
          <>
            {view === "grid" && (
              <p className="mt-4 text-pretty text-xs text-dim">
                <span className="text-muted">Board</span> is our rank.{" "}
                <span className="text-muted">Listed</span> is ansem.io order.{" "}
                <span className="text-muted">Airdrop</span> is value sent to $ANSEM holders.{" "}
                <span className="text-muted">Score</span> is airdrop + burns + boosts — not z500.
              </p>
            )}
            <div
              className={cn(
                "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
                view === "table" && "md:hidden",
              )}
            >
              {shown.map((p, i) => (
                <article key={p.id} className="board-card flex w-full min-w-0 flex-col overflow-hidden border border-border bg-bg hover:bg-row">
                  <div className="flex flex-1 flex-col p-3">
                  <div className="flex gap-3">
                    <Link href={`/c/${p.mint}`} className="shrink-0 self-start" aria-label={`Open ${p.name}`}>
                      <CoinThumb src={p.imageUrl} label={p.ticker || p.name} size={112} className="size-28 text-2xl" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-end gap-1">
                          <Link href={`/c/${p.mint}`} className="min-w-0">
                            <span className="block truncate text-base font-medium text-ink">
                              <ScrambleText text={p.name} />
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-dim">
                              {p.ticker ? `$${p.ticker}` : shortAddr(p.mint)}
                            </span>
                          </Link>
                          <CopyAddr value={p.mint} label="mint address" />
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          {p.boostPoints > 0 && <BoostChip p={p} />}
                          <TierBadge tier={p.tier} />
                        </span>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-muted">
                        <span title="This board's rank. Score adds verified $ANSEM burns.">
                          <span className="type-th">Board</span>{" "}
                          <span className="text-ink">
                            <LiveNum value={rankStart + i + 1} format="rank" flash={false} />
                            {p.rankDelta !== 0 && (
                              <span className="ml-1">
                                <LiveShift value={p.rankDelta} />
                              </span>
                            )}
                          </span>
                        </span>
                        <span title="ansem.io order from public airdrop + boosts. Not the unpublished z500 formula.">
                          <span className="type-th">Listed</span>{" "}
                          <span className="text-ink">
                            {p.officialRank == null ? (
                              "—"
                            ) : (
                              <>
                                <LiveNum value={p.officialRank} format="rank" flash={false} />
                                {p.officialDelta != null && p.officialDelta !== 0 && (
                                  <span className="ml-1">
                                    <LiveShift value={p.officialDelta} />
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        </span>
                      </p>
                      {(p.flags || []).length > 0 && (
                        <div className="mt-1.5 min-w-0">
                          <FlagChips flags={p.flags} compact walletHref={p.launchWallet} />
                        </div>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                    <MiniStat
                      k="Market cap"
                      hint="Circulating market cap from DexScreener"
                      v={<LiveNum value={p.live?.marketCap} format={fmtUsd} />}
                      className="text-sm"
                    />
                    <MiniStat
                      k="Airdrop"
                      hint="Dollar value of tokens sent to $ANSEM holders"
                      v={<LiveNum value={p.live?.airdropMcap} format={fmtUsd} />}
                      className="text-sm"
                    />
                    <MiniStat
                      k="24h change"
                      hint="Price change over the last 24 hours"
                      v={<LiveNum value={p.live?.change24h} format={fmtPct} flash={false} />}
                      className={cn("text-sm", changeClass(p.live?.change24h))}
                    />
                    <MiniStat
                      k="Score"
                      hint="Our ranking: airdrop + verified burns + boosts. Not z500."
                      v={<LiveNum value={p.score} format={fmtUsd} />}
                      className="text-sm"
                    />
                    <MiniStat
                      k="Burned"
                      hint="$ANSEM burned from the launch wallet"
                      v={
                        <span className="inline-flex min-w-0 items-baseline gap-1">
                          <BurnCell
                            compact
                            p={p}
                            verifying={verifying === p.id}
                            canEdit={p.source === "community" && p.addedBy === board.sid}
                            onVerify={() => verify(p)}
                            onDeep={() => verify(p, true)}
                            onBurn={(v) => patchBurn(p, v)}
                          />
                          <span className="text-[10px] text-dim">$ANSEM</span>
                        </span>
                      }
                      className="text-sm"
                    />
                    <MiniStat
                      k="Top 10"
                      hint="Share held by the top 10 wallets. Use Holders to refresh."
                      v={
                        p.holderTop10Pct != null ? (
                          <LiveNum value={p.holderTop10Pct * 100} format="holdPct" flash={false} />
                        ) : (
                          "—"
                        )
                      }
                      className="text-sm"
                    />
                  </dl>
                  <RowActions
                    p={p}
                    watched={watched.includes(p.mint)}
                    verifying={verifying === p.id}
                    checkingHolders={checkingHolders === p.id}
                    canEdit={p.source === "community" && p.addedBy === board.sid}
                    onWatch={() => toggleWatch(p.mint)}
                    onVerify={() => verify(p)}
                    onDeep={() => verify(p, true)}
                    onHolders={() => checkHolders(p)}
                    onReport={() => report(p)}
                    onDelete={() => setPendingDelete(p)}
                  />
                  </div>
                  <TradeLinks mint={p.mint} slug={p.slug} embedded />
                </article>
              ))}
            </div>

            <div
              className={cn(
                "board-scroll mt-3 overflow-x-auto border border-border bg-bg",
                view === "table" ? "hidden md:block" : "hidden",
              )}
            >
              <table className="board-table text-sm">
                <colgroup>
                  <col className="rank" />
                  <col className="coin" />
                  <col className="flags" />
                  <col className="tier" />
                  <col className="price" />
                  <col className="n" />
                  <col className="airdrop" />
                  <col className="chg" />
                  <col className="n" />
                  <col className="n" />
                  <col className="official" />
                  <col className="watch" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-panel">
                    <th className="type-th text-left">#</th>
                    <th className="type-th text-left">Coin</th>
                    <th className="type-th text-left">Flags</th>
                    <th className="type-th text-left">Tier</th>
                    <th className="type-th text-right">Price</th>
                    {th("mcap", "Mcap")}
                    {th("airdrop", "Airdrop")}
                    {th("change", "24h")}
                    {th("burn", "Burned")}
                    {th("score", "Score")}
                    {th("listed", "Listed")}
                    <th className="type-th text-right">Watch</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => {
                    const open = openMint === p.mint;
                    return (
                      <Fragment key={p.id}>
                    <tr className="border-b border-border transition-colors duration-150 hover:bg-row">
                      <td className="font-mono text-xs tabular-nums text-muted">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <LiveNum value={rankStart + i + 1} format="int" flash={false} />
                          {p.rankDelta !== 0 ? <LiveShift value={p.rankDelta} className="shrink-0 text-[10px] leading-none" /> : null}
                        </span>
                      </td>
                      <td className="coin">
                        <div className="flex w-full min-w-0 flex-col items-start gap-1">
                          <div className="flex w-full min-w-0 items-center gap-2.5">
                            <Link href={`/c/${p.mint}`} className="flex min-w-0 items-center gap-2.5">
                              <CoinThumb src={p.imageUrl} label={p.ticker || p.name} size={26} className="size-[26px]" />
                              <span className="min-w-0 truncate leading-4">
                                <span className="text-[13px] font-medium text-ink">
                                  <ScrambleText text={p.name} />
                                </span>
                                <span className="ml-2 font-mono text-[11px] text-dim">
                                  {p.ticker ? `$${p.ticker}` : shortAddr(p.mint)}
                                </span>
                              </span>
                            </Link>
                            <CopyAddr value={p.mint} label="mint address" />
                            {p.boostPoints > 0 && <BoostChip p={p} />}
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={open ? `Hide ${p.name} details` : `Show ${p.name} details`}
                              onClick={() => setOpenMint(open ? null : p.mint)}
                              className="shrink-0 text-dim hover:text-ink"
                            >
                              <Spin open={open}>
                                <ChevronDown size={14} />
                              </Spin>
                            </button>
                            <Link
                              href={`/c/${p.mint}`}
                              aria-label={`Open ${p.name}`}
                              className="shrink-0 text-dim hover:text-ink"
                            >
                              <ExternalLink size={10} />
                            </Link>
                          </div>
                          {p.fetchError && <span className="block text-[10px] text-bad">{p.fetchError}</span>}
                        </div>
                      </td>
                      <td>
                        {(p.flags || []).length > 0 ? (
                          <FlagChips
                            flags={p.flags}
                            compact
                            walletHref={p.launchWallet}
                            className="max-w-full flex-col items-start gap-1"
                          />
                        ) : null}
                      </td>
                      <td>
                        <TierBadge tier={p.tier} />
                      </td>
                      <td className="num text-ink">
                        <LiveNum value={p.live?.priceUsd} format={fmtPrice} />
                      </td>
                      <td className="num text-ink">
                        <LiveNum value={p.live?.marketCap} format={fmtUsd} />
                      </td>
                      <td className="num text-ink">
                        <LiveNum value={p.live?.airdropMcap} format={fmtUsd} />
                      </td>
                      <td className="num">
                        <span className={p.live?.change24h == null ? "text-dim" : p.live.change24h >= 0 ? "text-good" : "text-bad"}>
                          <LiveNum value={p.live?.change24h} format={fmtPct} flash={false} />
                        </span>
                      </td>
                      <td className="num">
                        <BurnCell
                          compact
                          p={p}
                          verifying={verifying === p.id}
                          canEdit={p.source === "community" && p.addedBy === board.sid}
                          onVerify={() => verify(p)}
                          onDeep={() => verify(p, true)}
                          onBurn={(v) => patchBurn(p, v)}
                        />
                      </td>
                      <td className="num font-medium text-ink">
                        <LiveNum value={p.score} format={fmtUsd} />
                      </td>
                      <td className="num">
                        {p.officialRank == null ? (
                          <span className="text-dim">—</span>
                        ) : (
                          <span className="whitespace-nowrap text-muted">
                            <LiveNum value={p.officialRank} format={fmtRank} flash={false} />
                            {p.officialDelta != null && p.officialDelta !== 0 ? (
                              <span className="ml-1">
                                <LiveShift value={p.officialDelta} />
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {p.launchWallet ? (
                            <CheckBurns
                              p={p}
                              verifying={verifying === p.id}
                              onVerify={() => verify(p)}
                              onDeep={() => verify(p, true)}
                            />
                          ) : (
                            <span className="inline-block h-[29px] w-[108px] shrink-0" aria-hidden />
                          )}
                          <IconBtn
                            label={watched.includes(p.mint) ? "Unwatch" : "Watch"}
                            onClick={() => toggleWatch(p.mint)}
                          >
                            <Star
                              size={14}
                              className={watched.includes(p.mint) ? "fill-accent text-accent" : "text-dim"}
                            />
                          </IconBtn>
                          <IconBtn
                            label="How concentrated the top holders are"
                            onClick={() => checkHolders(p)}
                            disabled={checkingHolders === p.id}
                          >
                            {checkingHolders === p.id ? (
                              <span className="font-mono text-[10px] text-muted">…</span>
                            ) : p.holderTop10Pct != null ? (
                              <span className="font-mono text-[10px] text-muted">
                                <LiveNum
                                  value={p.holderTop10Pct * 100}
                                  format="holdPct"
                                  flash={false}
                                />
                              </span>
                            ) : (
                              <Users size={14} className="text-dim" />
                            )}
                          </IconBtn>
                          {p.source === "community" && (
                            <>
                              <IconBtn label="Report junk" onClick={() => report(p)}>
                                <Flag size={14} className="text-dim" />
                              </IconBtn>
                              {p.addedBy === board.sid && (
                                <IconBtn label="Remove" onClick={() => setPendingDelete(p)}>
                                  <Trash2 size={14} className="text-dim" />
                                </IconBtn>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-border bg-panel last:border-b-0">
                        <td colSpan={12} className="details">
                          <motion.div
                            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                            className="flex flex-wrap items-center justify-between gap-3"
                          >
                            <TradeLinks mint={p.mint} slug={p.slug} />
                            <Link href={`/c/${p.mint}`} className="type-btn text-muted hover:text-ink">
                              <ScrambleText text="Open dossier" />
                            </Link>
                          </motion.div>
                        </td>
                      </tr>
                    ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <Pager
                page={safePage}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={PAGE}
                onPage={goToPage}
              />
            )}
          </>
        )}

        <div id="notes" className="mt-10 max-w-[720px] space-y-3 text-pretty text-[12.5px] leading-relaxed text-dim">
          <p>
            Rank here follows the sort you picked. Listed # uses public ansem.io inputs (airdrop value + boosts) — not
            the unpublished z500 formula. Score adds verified $ANSEM burns.{" "}
            <Link href="/guide" className="text-muted hover:text-ink">
              <ScrambleText text="How to read this site" />
            </Link>
            .
          </p>
          <p>
            Prices come from ansem.io and DexScreener. Burns are checked on Solana from the launch wallet, in the
            scanned window. Missing a coin? Add it. Not financial advice. Session cookie only. See{" "}
            <Link href="/privacy" className="text-muted hover:text-ink">
              <ScrambleText text="privacy" />
            </Link>
            .
          </p>
        </div>
      </main>

      <div
        ref={tickerRef}
        className="tk fixed inset-x-0 bottom-0 flex min-h-[var(--ticker-h)] items-center border-t border-border bg-void pb-[env(safe-area-inset-bottom)] font-mono text-[10px] sm:text-[10.5px]"
        style={{ zIndex: "var(--z-ticker)" }}
        aria-label="Live market tape"
      >
        <div className="tk-clip">
          {tickerTape.length === 0 ? (
            <span className="block px-[18px] py-2 text-dim">Waiting for prices</span>
          ) : (
            <div className="tk-track" style={{ "--tk-duration": `${Math.max(42, movers.length * 1.75)}s` } as CSSProperties}>
              {[0, 1].map((copy) => (
                <div key={copy} className="tk-track__copy" aria-hidden={copy === 1 || undefined}>
                  {tickerTape.map((p, i) => {
                    const chg = p.live?.change24h || 0;
                    const inner = (
                      <>
                        <span className="text-ink">${p.ticker || p.name}</span>
                        <span className="text-dim">
                          <LiveNum value={p.live?.marketCap} format={fmtUsd} />
                        </span>
                        <span className={chg >= 0 ? "text-good" : "text-bad"}>
                          <LiveNum value={p.live?.change24h} format={fmtPct} flash={false} />
                        </span>
                      </>
                    );
                    const className =
                      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums";
                    return copy === 1 ? (
                      <span key={`${copy}-${p.id}-${i}`} className={className}>
                        {inner}
                      </span>
                    ) : (
                      <Link
                        key={`${copy}-${p.id}-${i}`}
                        href={`/c/${p.mint}`}
                        className={cn(className, "hover:[&>span:first-child]:text-gold-lit")}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex h-[var(--ticker-h)] shrink-0 items-center">
          <TickerPin label="SOL" value={board.solPrice} format={fmtUsd} />
          <TickerPin label="ANSEM" value={board.ansemPrice} format={fmtAnsem} />
        </div>
      </div>

      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="del-title"
        className="w-[min(calc(100vw-2rem),400px)] max-w-full border border-border bg-panel p-5 text-ink"
        style={{ zIndex: "var(--z-dialog)" }}
        onClose={() => setPendingDelete(null)}
      >
        <h2 id="del-title" className="text-balance text-base font-semibold text-ink">
          Remove {pendingDelete?.name}?
        </h2>
        <p className="mt-3 text-pretty text-sm text-muted">This drops it from the shared community list.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className="type-btn h-8 border border-border px-3 text-muted"
          >
            <ScrambleText text="Cancel" />
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            className="type-btn h-8 border border-bad bg-bad px-3 font-semibold text-ink"
          >
            <ScrambleText text="Remove" />
          </button>
        </div>
      </dialog>
    </div>
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
    <nav aria-label="Board pages" className="mt-6 flex flex-col items-center gap-3">
      <p className="font-mono text-[10.5px] tabular-nums text-dim">
        <LiveNum value={start} format="int" flash={false} />
        –
        <LiveNum value={end} format="int" flash={false} /> of{" "}
        <LiveNum value={total} format="int" flash={false} />
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="type-btn inline-flex size-8 items-center justify-center border border-border bg-panel text-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
        {paginationItems(page, pageCount).map((item, i) =>
          item === "gap" ? (
            <span
              key={`gap-${i}`}
              className="grid size-8 place-items-center font-mono text-xs tabular-nums text-dim"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPage(item)}
              className={cn(
                "type-btn inline-flex size-8 items-center justify-center border font-mono text-xs tabular-nums",
                item === page
                  ? "border-accent bg-accent text-void"
                  : "border-border bg-panel text-muted hover:text-ink",
              )}
            >
              {item}
            </button>
          ),
        )}
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

function BoostChip({ p }: { p: Project }) {
  return (
    <span
      className={cn(
        "inline-flex h-[17px] shrink-0 items-center whitespace-nowrap rounded-[5px] px-1.5 font-mono text-[8.5px] font-semibold uppercase leading-none tabular-nums",
        p.boostGolden ? "bg-diamond text-void" : "bg-accent-soft text-void",
      )}
    >
      boost <LiveNum value={p.boostPoints} format={fmtInt} flash={false} className="ml-0.5" />
    </span>
  );
}

const TIER_BADGE: Record<string, string> = {
  Bronze: "border-bronze-lit bg-transparent text-bronze-lit",
  Gold: "border-gold-lit bg-transparent text-gold-lit",
  Diamond: "border-diamond bg-transparent text-diamond",
};

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

function Stat({
  icon,
  k,
  value,
  format,
  c,
}: {
  icon: StatIconName;
  k: string;
  value: number | null | undefined;
  format: (n: number | null | undefined) => string;
  c: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="type-eyebrow stat-k text-pretty">
        <StatIcon name={icon} />
        {k}
      </p>
      <p className="mt-1 truncate font-mono text-[20px] leading-7 text-ink tabular-nums">
        <LiveNum value={value} format={format} reel />
      </p>
      <p className="mt-1 text-pretty text-[12px] text-dim">{c}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="type-eyebrow mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-[3px] p-1 text-dim disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function CheckBurns({
  p,
  verifying,
  onVerify,
  onDeep,
}: {
  p: Project;
  verifying: boolean;
  onVerify: () => void;
  onDeep: () => void;
}) {
  return (
    <button
      type="button"
      onClick={p.verifyExhausted ? onVerify : onDeep}
      disabled={verifying}
      className="btn-boost"
    >
      <ScrambleText
        text={verifying ? "Checking…" : p.verifiedBurn != null ? (p.verifyExhausted ? "Check again" : "Check older") : "Check burns"}
      />
    </button>
  );
}

function BurnCell({
  p,
  verifying,
  canEdit,
  compact = false,
  onVerify,
  onDeep,
  onBurn,
}: {
  p: Project;
  verifying: boolean;
  canEdit: boolean;
  compact?: boolean;
  onVerify: () => void;
  onDeep: () => void;
  onBurn: (v: string) => void;
}) {
  const amount =
    p.verifiedBurn != null ? (
      <span className="font-mono text-xs font-medium tabular-nums text-good">
        <LiveNum value={p.verifiedBurn} format={fmtCompact} flash={false} />
      </span>
    ) : canEdit ? (
      <input
        type="number"
        value={p.burnAmount || ""}
        onChange={(e) => onBurn(e.target.value)}
        placeholder="0"
        className="h-[29px] w-20 max-w-full border border-input-border bg-input px-2 text-right font-mono text-xs tabular-nums text-accent-soft"
      />
    ) : p.launchWallet ? (
      <span className="font-mono text-xs tabular-nums text-dim">Pending</span>
    ) : (
      <span className="font-mono text-xs tabular-nums text-muted">
        {p.burnAmount ? <LiveNum value={p.burnAmount} format={fmtNum} flash={false} /> : "—"}
      </span>
    );

  const check = p.launchWallet ? (
    <CheckBurns p={p} verifying={verifying} onVerify={onVerify} onDeep={onDeep} />
  ) : null;

  if (compact) return amount;

  return (
    <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
      {p.verifiedBurn != null ? (
        <>
          {amount}
          <span className="font-mono text-[9px] uppercase text-good">
            {p.verifyExhausted ? "on-chain" : "partial scan"}
          </span>
        </>
      ) : canEdit ? (
        <>
          {amount}
          <span className="font-mono text-[9px] uppercase text-dim">
            {p.burnAmount ? "you entered this" : "none yet"}
          </span>
        </>
      ) : p.launchWallet ? (
        <>
          {amount}
          <span className="font-mono text-[9px] uppercase text-dim">scan queued</span>
        </>
      ) : (
        amount
      )}
      {check ? <div className="mt-1">{check}</div> : null}
    </div>
  );
}

function RowActions({
  p,
  watched,
  verifying,
  checkingHolders,
  canEdit,
  onWatch,
  onVerify,
  onDeep,
  onHolders,
  onReport,
  onDelete,
}: {
  p: Project;
  watched: boolean;
  verifying: boolean;
  checkingHolders: boolean;
  canEdit: boolean;
  onWatch: () => void;
  onVerify: () => void;
  onDeep: () => void;
  onHolders: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {p.launchWallet ? (
        <CheckBurns p={p} verifying={verifying} onVerify={onVerify} onDeep={onDeep} />
      ) : null}
      <button type="button" onClick={onWatch} className="type-btn inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-muted">
        <ScrambleText text={watched ? "Unwatch" : "Watch"} />
      </button>
      <button
        type="button"
        onClick={onHolders}
        disabled={checkingHolders}
        className="type-btn inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-muted"
      >
        <ScrambleText text={checkingHolders ? "Checking…" : "Holders"} />
      </button>
      {p.source === "community" && (
        <button type="button" onClick={onReport} className="type-btn inline-flex min-h-8 items-center text-muted">
          <ScrambleText text="Report" />
        </button>
      )}
      {canEdit && (
        <button type="button" onClick={onDelete} className="type-btn inline-flex min-h-8 items-center text-bad">
          <ScrambleText text="Remove" />
        </button>
      )}
    </div>
  );
}
