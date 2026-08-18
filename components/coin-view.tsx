"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnsemCta } from "@/components/ansem-cta";
import { CoinShareCard } from "@/components/coin-share-card";
import { CoinThumb } from "@/components/coin-thumb";
import { CopyAddr } from "@/components/copy-addr";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum, LiveShift } from "@/components/live-num";
import { useBoardPoll } from "@/components/use-board-poll";
import { PageBack } from "@/components/page-back";
import { PriceChart } from "@/components/price-chart";
import { RankSparkline } from "@/components/rank-sparkline";
import { Reveal } from "@/components/reveal";
import { ScrambleText } from "@/components/scramble-text";
import { Scorecard } from "@/components/scorecard";
import { SiteHeader } from "@/components/site-header";
import { TapeStrip } from "@/components/tape-strip";
import { TimeAgo } from "@/components/time-ago";
import { TradeLinks } from "@/components/trade-links";
import { loadLocalWatches, pushWatches, saveLocalWatches } from "@/components/watch-sync";
import type { CoinPayload } from "@/lib/coin";
import { cn } from "@/lib/cn";
import { iframeSnippet } from "@/lib/embed";
import { fmtCompact, fmtPct, fmtPrice, fmtRank, fmtUsd, shortAddr } from "@/lib/format";
import { isEnhanced } from "@/lib/ansem";
import { publicImageUrl } from "@/lib/media";
import { ANSEM_AIRDROP, ansemCoinUrl, solscanAccount, solscanTx, tradeLinks } from "@/lib/links";
import { projectFlags, provenanceLabel } from "@/lib/flags";
import { projectRubric } from "@/lib/rubric";
import { computeScore } from "@/lib/score";
import { simulateBurn } from "@/lib/sim";
import type { BoardResponse, Dossier, LedgerHit, Project } from "@/lib/types";

const watchListeners = new Set<() => void>();

function mergeHits(prev: LedgerHit[], hits: LedgerHit[]) {
  if (!hits.length) return prev;
  const seen = new Set(prev.map((h) => h.signature));
  const fresh = hits.filter((h) => h.signature && h.amount > 0 && !seen.has(h.signature));
  return fresh.length ? [...fresh, ...prev].slice(0, 40) : prev;
}

function loadWatched(): string[] {
  return loadLocalWatches();
}

function subscribeWatch(cb: () => void) {
  watchListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    watchListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function persistWatch(next: string[]) {
  saveLocalWatches(next);
  watchListeners.forEach((fn) => fn());
  void pushWatches(next);
}

export function CoinView({ initial }: { initial: CoinPayload }) {
  const [project, setProject] = useState(initial.project);
  const [dossier, setDossier] = useState<Dossier | null>(initial.dossier);
  const [tape, setTape] = useState(initial.tape);
  const [scores, setScores] = useState(initial.scores);
  const [burns, setBurns] = useState(initial.burns || []);
  const [extra, setExtra] = useState("10000");
  const [verifying, setVerifying] = useState(false);
  const [checkingHolders, setCheckingHolders] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watched = useSyncExternalStore(
    subscribeWatch,
    () => loadWatched().includes(project.mint),
    () => false,
  );

  const applyBoard = useCallback(
    (incoming: BoardResponse) => {
      const row = incoming.projects.find((item) => item.mint === initial.project.mint);
      if (!row) return;
      setProject((prev) => ({
        ...prev,
        live: row.live,
        score: row.score,
        officialRank: row.officialRank,
        officialDelta: row.officialDelta,
        rankDelta: row.rankDelta,
        boostPoints: row.boostPoints,
        boostGolden: row.boostGolden,
        verifiedBurn: row.verifiedBurn ?? prev.verifiedBurn,
        listedAirdropMcap: row.listedAirdropMcap,
        listedMarketCap: row.listedMarketCap,
        launchCount: row.launchCount || prev.launchCount,
        holderTop10Pct: row.holderTop10Pct ?? prev.holderTop10Pct,
        insiderPct: row.insiderPct ?? prev.insiderPct,
        sniper: row.sniper || prev.sniper,
        walletProvenance: row.walletProvenance || prev.walletProvenance,
        enhancedAt: row.enhancedAt ?? prev.enhancedAt,
        flags: row.flags?.length ? row.flags : prev.flags,
      }));
      setScores(incoming.projects.map((item) => ({ mint: item.mint, score: item.score })));
      setTape((prev) => {
        const next = (incoming.tape || []).filter((event) => event.mint === initial.project.mint);
        if (!next.length) return prev;
        const seen = new Set(next.map((event) => event.id));
        return [...next, ...prev.filter((event) => !seen.has(event.id))];
      });
      setBurns((prev) =>
        mergeHits(
          prev,
          (incoming.tape || [])
            .filter((event) => event.kind === "burn" && event.mint === initial.project.mint && event.amount && event.id.startsWith("burn:"))
            .map((event) => ({
              signature: event.id.slice(5),
              wallet: row.launchWallet || "",
              amount: event.amount || 0,
              at: event.at,
              mint: initial.project.mint,
            })),
        ),
      );
    },
    [initial.project.mint],
  );
  useBoardPoll(applyBoard);

  const sim = useMemo(() => {
    const amount = Number(extra) || 0;
    return simulateBurn(
      [
        project,
        ...scores
          .filter((s) => s.mint !== project.mint)
          .map((s) => ({
            mint: s.mint,
            score: s.score,
            live: null,
            verifiedBurn: null,
            burnAmount: 0,
            burnPriceRef: 0,
            boostPoints: 0,
          })),
      ],
      project.mint,
      amount,
    );
  }, [extra, scores, project]);

  const toggleWatch = () => {
    const next = loadWatched();
    persistWatch(next.includes(project.mint) ? next.filter((m) => m !== project.mint) : [...next, project.mint]);
  };

  const verify = async (deep = false) => {
    if (!project.launchWallet) return;
    setVerifying(true);
    setError(null);
    try {
      const [burnRes, provRes] = await Promise.all([
        fetch("/api/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: project.launchWallet, deep }),
        }),
        fetch("/api/provenance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mint: project.mint, wallet: project.launchWallet }),
        }),
      ]);
      const json = await burnRes.json();
      if (!burnRes.ok) throw new Error(json.error);
      const prov = provRes.ok ? await provRes.json() : null;
      if (prov?.dossier) setDossier(prov.dossier);
      setProject((p) => {
        const next: Project = {
          ...p,
          verifiedBurn: json.verifiedBurn,
          verifiedTxChecked: json.txChecked,
          verifiedAt: json.scannedAt,
          verifyExhausted: json.exhausted,
          walletProvenance: prov?.status ?? p.walletProvenance,
        };
        next.score = computeScore({ ...next, burnPriceRef: initial.ansemPrice || p.burnPriceRef });
        return { ...next, flags: projectFlags(next) };
      });
      if (Array.isArray(json.hits) && json.hits.length) {
        setBurns((prev) => mergeHits(prev, json.hits as LedgerHit[]));
      }
    } catch {
      setError("Couldn't reach Solana RPC — try again.");
    } finally {
      setVerifying(false);
    }
  };

  const checkHolders = async () => {
    setCheckingHolders(true);
    setError(null);
    try {
      const res = await fetch("/api/holders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: project.mint }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.dossier) setDossier(json.dossier);
      else if (json.holders) {
        setDossier((d) =>
          d
            ? { ...d, holders: json.holders, sniper: json.sniper ?? d.sniper }
            : {
                at: json.at || Date.now(),
                holders: json.holders,
                creator: project.launchWallet,
                onchainCreator: null,
                pumpCreator: null,
                createSig: null,
                createSlot: null,
                sameBlockBuys: 0,
                sameBlockWallets: 0,
                sniper: Boolean(json.sniper),
              },
        );
      }
      setProject((p) => {
        const next = {
          ...p,
          holderTop10Pct: json.top10Pct,
          insiderPct: json.insiderPct ?? p.insiderPct,
          sniper: json.sniper ?? p.sniper,
        };
        return { ...next, flags: projectFlags(next) };
      });
    } catch {
      setError("Couldn't read holder concentration.");
    } finally {
      setCheckingHolders(false);
    }
  };

  const p = project;
  const history = initial.history.slice(-16);
  const ansem = ansemCoinUrl(p.slug);
  const banner = publicImageUrl(p.bannerUrl);
  const rubric = useMemo(() => projectRubric(p, dossier), [p, dossier]);

  return (
    <div className="min-h-dvh bg-bg pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <PageBack href="/" />
          <span>
            <Link href="/" className="text-muted hover:text-ink">
              <ScrambleText text="Board" />
            </Link>
            <span className="text-dim"> / coin</span>
          </span>
        </p>
        {banner ? (
          <div className="relative mt-3 h-24 w-full overflow-hidden border border-border bg-raised sm:h-32">
            <Image
              src={banner}
              alt=""
              fill
              sizes="(max-width: 1400px) 100vw, 1400px"
              className="object-cover"
              priority
              onError={() => setProject((prev) => ({ ...prev, bannerUrl: null }))}
            />
          </div>
        ) : null}
        <div className="mt-3 flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start gap-3">
          <CoinThumb
            src={p.imageUrl}
            label={p.ticker || p.name}
            size={48}
            className="size-12 text-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="display text-balance display-title text-ink">
              <ScrambleText text={p.name} />
            </h1>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-dim">
              <span>
                {[p.ticker ? `$${p.ticker}` : null, p.tier || null, p.status ? p.status.replace("_", " ") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <CoinActs mint={p.mint} enhanced={isEnhanced(p)} onError={(message) => setError(message)} />
            </p>
              <div className="mt-3">
                <p
                  className={cn(
                    "mb-2 font-mono text-[11px] uppercase tabular-nums",
                    rubric.mark === "fail"
                      ? "text-bad"
                      : rubric.mark === "warn"
                        ? "text-gold-lit"
                        : rubric.mark === "pass"
                          ? "text-good"
                          : "text-dim",
                  )}
                >
                  {rubric.label}
                  {rubric.risk > 0 ? (
                    <>
                      {" · "}
                      <LiveNum value={rubric.risk} format="int" flash={false} />
                    </>
                  ) : null}
                </p>
                <FlagChips flags={p.flags} walletHref={p.launchWallet} />
                <p className="mt-2">
                  <Link href="/guide#scorecard" className="font-mono text-[11px] text-dim hover:text-ink">
                    <ScrambleText text="How this is graded" />
                  </Link>
                </p>
              </div>
          </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleWatch}
            className="type-btn h-9 shrink-0 border border-border px-3 text-muted hover:text-ink sm:h-8"
          >
            <ScrambleText text={watched ? "Watching" : "Watch"} />
          </button>
          {ansem ? (
            <AnsemCta href={ansem} primary>
              Open on ansem.io
            </AnsemCta>
          ) : null}
          <a
            href={`/partner?mint=${p.mint}`}
            className="type-btn grid h-9 place-items-center border border-border px-3 text-muted hover:text-ink sm:h-8"
          >
            <ScrambleText text="Embed" />
          </a>
          <button
            type="button"
            onClick={async () => {
              const snippet = iframeSnippet(window.location.origin, p.mint, "card", p.name);
              try {
                await navigator.clipboard.writeText(snippet);
                setCopied(true);
              } catch {
                setError("Couldn't copy the embed snippet.");
              }
            }}
            className="type-btn h-9 shrink-0 border border-border px-3 text-muted hover:text-ink sm:h-8"
          >
            <ScrambleText text={copied ? "Copied" : "Copy iframe"} />
          </button>
          </div>
        </div>

        <Reveal show={!!error}>
          <p className="mt-4 text-sm text-bad">{error}</p>
        </Reveal>

        <Scorecard rubric={rubric} />

        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          <Stat k="Mcap" v={<LiveNum value={p.live?.marketCap} format={fmtUsd} reel />} />
          <Stat k="Airdrop" v={<LiveNum value={p.live?.airdropMcap} format={fmtUsd} reel />} />
          <Stat k="Burned" v={<LiveNum value={p.verifiedBurn} format={fmtCompact} reel />} />
          <Stat k="Score" v={<LiveNum value={p.score} format={fmtUsd} reel />} />
          <Stat k="Price" v={<LiveNum value={p.live?.priceUsd} format={fmtPrice} reel />} />
          <Stat
            k="24h"
            v={<LiveNum value={p.live?.change24h} format={fmtPct} reel flash={false} />}
            valueClass={(p.live?.change24h || 0) >= 0 ? "text-good" : "text-bad"}
          />
          <Stat k="Liq" v={<LiveNum value={p.live?.liquidity} format={fmtUsd} reel />} />
          <Stat k="Listed" v={<LiveNum value={p.officialRank} format={fmtRank} reel />} />
        </dl>

        <PriceChart name={p.name} dexUrl={p.live?.dexUrl || tradeLinks(p.mint, p.slug).dex} />

        <section className="mt-8 border-t border-border pt-6">
          <h2 className="type-eyebrow">Trade out</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ansem ? <AnsemCta href={ansem}>Boost on ansem.io</AnsemCta> : null}
            <AnsemCta href={ANSEM_AIRDROP}>Claim on ansem.io</AnsemCta>
          </div>
          <div className="mt-3">
            <TradeLinks mint={p.mint} slug={p.slug} />
          </div>
        </section>

        <section className="mt-8 grid gap-8 border-t border-border pt-6 lg:grid-cols-2">
          <div>
            <h2 className="type-eyebrow">On-chain</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat k="Launch" v={<WalletCell wallet={p.launchWallet} />} size="sm" />
              <Stat
                k="Creator check"
                v={provenanceLabel(p.walletProvenance)}
                size="sm"
                valueClass={
                  p.walletProvenance === "mismatch"
                    ? "text-gold-lit"
                    : p.walletProvenance === "matched"
                      ? "text-good"
                      : "text-dim"
                }
              />
              <Stat k="Create" v={<WalletCell wallet={dossier?.onchainCreator} />} size="sm" />
              <Stat k="Pump" v={<WalletCell wallet={dossier?.pumpCreator} />} size="sm" />
              <Stat
                k="Top 10"
                v={
                  <LiveNum
                    value={p.holderTop10Pct == null ? null : p.holderTop10Pct * 100}
                    format="holdPct"
                  />
                }
                size="sm"
              />
              <Stat
                k="Insiders"
                v={
                  <LiveNum
                    value={p.insiderPct == null ? null : p.insiderPct * 100}
                    format="holdPct"
                  />
                }
                size="sm"
              />
              <Stat
                k="Launches"
                v={
                  p.launchWallet ? (
                    <Link href={`/wallets/${p.launchWallet}`} className="hover:text-ink">
                      <LiveNum value={p.launchCount || 1} format="int" flash={false} />
                    </Link>
                  ) : (
                    "—"
                  )
                }
                size="sm"
              />
              <Stat
                k="Same slot"
                v={
                  <>
                    <LiveNum value={dossier?.sameBlockWallets} format="int" />
                    {dossier?.sameBlockBuys ? (
                      <>
                        {" / "}
                        <LiveNum value={dossier.sameBlockBuys} format="int" flash={false} /> buys
                      </>
                    ) : null}
                  </>
                }
                size="sm"
              />
              <Stat
                k="Scanned"
                v={
                  p.verifiedAt ? (
                    <>
                      <TimeAgo at={p.verifiedAt} />
                      {p.verifiedTxChecked != null ? (
                        <>
                          {" · "}
                          <LiveNum value={p.verifiedTxChecked} format="int" flash={false} /> tx
                        </>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )
                }
                size="sm"
              />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {p.launchWallet && (
                <button
                  type="button"
                  onClick={() => verify(!p.verifyExhausted)}
                  disabled={verifying}
                  className="type-btn h-8 border border-accent bg-accent px-3 font-semibold text-void disabled:opacity-40"
                >
                  <ScrambleText
                    text={verifying ? "Checking…" : p.verifiedBurn != null ? "Check burns" : "Verify burns"}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={checkHolders}
                disabled={checkingHolders}
                className="type-btn h-8 border border-border px-3 text-muted disabled:opacity-40"
              >
                <ScrambleText text={checkingHolders ? "Checking…" : "Holders"} />
              </button>
            </div>
            {burns.length ? (
              <div className="mt-4 border-t border-border pt-3">
                <h3 className="type-eyebrow">Burn ledger</h3>
                <ol className="mt-1">
                  {burns.slice(0, 12).map((hit) => (
                    <li
                      key={hit.signature}
                      className="flex items-baseline justify-between gap-3 py-1.5 font-mono text-[12px] tabular-nums text-ink"
                    >
                      <a
                        href={solscanTx(hit.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-muted hover:text-ink"
                      >
                        {shortAddr(hit.signature)}
                      </a>
                      <span className="shrink-0">
                        <LiveNum value={hit.amount} format={fmtCompact} flash={false} />
                        <span className="ml-2 text-dim">
                          <TimeAgo at={hit.at} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : p.launchWallet ? (
              <p className="mt-4 text-pretty text-[12.5px] text-dim">
                No per-tx burns yet. Use Verify burns above, or wait for a live hit.
              </p>
            ) : null}
            <p className="mt-4 max-w-[40rem] text-pretty text-[12.5px] text-dim">
              Contract{" "}
              <a
                href={solscanAccount(p.mint)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all hover:text-ink"
              >
                {p.mint}
              </a>
              <CopyAddr value={p.mint} label="mint address" className="ml-1" />
              {dossier?.createSig ? (
                <>
                  {" · create tx "}
                  <span className="inline-flex items-center gap-1">
                    <a
                      href={solscanTx(dossier.createSig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-ink"
                    >
                      {shortAddr(dossier.createSig)}
                    </a>
                    <CopyAddr value={dossier.createSig} label="create transaction" />
                  </span>
                  {dossier.createSlot ? (
                    <>
                      {" · slot "}
                      <LiveNum value={dossier.createSlot} format="int" flash={false} />
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
          </div>
          <div>
            <h2 className="type-eyebrow">Burn impact</h2>
            <p className="mt-3 text-pretty text-sm text-muted">
              If this launch burns more $ANSEM, where does our score put it.
            </p>
            <label className="mt-4 block">
              <span className="type-eyebrow mb-2 block">Extra $ANSEM burned</span>
              <input
                type="number"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className="h-11 w-full max-w-[16rem] border border-input-border bg-input px-3 font-mono text-base tabular-nums text-ink sm:h-8 sm:text-sm"
              />
            </label>
            {sim && (
              <p className="mt-3 font-mono text-sm tabular-nums text-ink">
                <LiveNum value={sim.currentRank} format={fmtRank} flash={false} />
                {" → "}
                <LiveNum value={sim.nextRank} format={fmtRank} />
                <span className={cn("ml-2", sim.delta > 0 ? "text-good" : sim.delta < 0 ? "text-bad" : "text-dim")}>
                  {sim.delta === 0 ? "same" : <LiveShift value={sim.delta} />}
                </span>
                <span className="ml-2 text-dim">
                  <LiveNum value={sim.nextScore} format={fmtUsd} />
                </span>
              </p>
            )}
            {ansem ? (
              <div className="mt-4">
                <AnsemCta href={ansem} primary>
                  Burn on ansem.io
                </AnsemCta>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8 border-t border-border pt-6">
          <h2 className="type-eyebrow">Rank history</h2>
          {history.length < 2 ? (
            <p className="mt-3 text-sm text-muted">No snapshots yet — wait for the next scan pass.</p>
          ) : (
            <div className="mt-4">
              <RankSparkline points={history} />
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-8 border-t border-border pt-6 lg:grid-cols-2">
          <div>
            <h2 className="type-eyebrow">Top holders</h2>
            {dossier?.holders?.length ? (
              <ol className="mt-3 space-y-1.5 font-mono text-[11px] tabular-nums">
                {dossier.holders.map((h) => (
                  <li key={h.address} className="flex justify-between gap-3 text-muted">
                    <span className={cn("inline-flex min-w-0 items-center gap-1", h.insider ? "text-bad" : "text-ink")}>
                      <a
                        href={solscanAccount(h.owner || h.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gold-lit"
                      >
                        {shortAddr(h.owner || h.address)}
                      </a>
                      <CopyAddr value={h.owner || h.address} label="holder address" />
                    </span>
                    <span>
                      <LiveNum value={h.pct} format={(n) => (n == null ? "—" : `${n.toFixed(1)}%`)} flash={false} />
                      {h.insider ? " insider" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted">Hit Holders to pull the top accounts.</p>
            )}
          </div>
          <CoinShareCard project={p} dossier={dossier} />
        </section>

        <section className="mt-6 flex min-h-[var(--ticker-h)] min-w-0 items-center overflow-hidden border-y border-border">
          <h2 className="type-eyebrow flex h-full shrink-0 items-center pr-2 leading-none sm:pr-3">Tape</h2>
          <TapeStrip events={tape} />
        </section>
      </main>
    </div>
  );
}

function CoinActs({
  mint,
  enhanced,
  onError,
}: {
  mint: string;
  enhanced: boolean;
  onError: (message: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted">
      <span>{shortAddr(mint)}</span>
      <CopyAddr value={mint} label="mint address" onError={onError} />
      {enhanced ? (
        <>
          <span aria-hidden className="text-dim">
            ◆
          </span>
          <span className="inline-flex h-[17px] items-center rounded-[5px] border border-gold px-1.5 font-semibold uppercase leading-none text-gold-lit">
            Enhanced
          </span>
        </>
      ) : null}
    </span>
  );
}

function WalletCell({ wallet }: { wallet: string | null | undefined }) {
  if (!wallet) return "—";
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <Link href={`/wallets/${wallet}`} className="min-w-0 truncate hover:text-ink">
        {shortAddr(wallet)}
      </Link>
      <CopyAddr value={wallet} label="wallet address" />
    </span>
  );
}

function Stat({
  k,
  v,
  size = "lg",
  valueClass,
}: {
  k: string;
  v: ReactNode;
  size?: "lg" | "sm";
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow">{k}</dt>
      <dd
        className={cn(
          "mt-1 font-mono tabular-nums",
          size === "lg" ? "truncate text-lg" : "text-sm",
          valueClass ?? "text-ink",
        )}
      >
        {v}
      </dd>
    </div>
  );
}
