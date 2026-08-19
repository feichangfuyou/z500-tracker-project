import Link from "next/link";
import { LiveNum } from "@/components/live-num";
import { fmtCompact, fmtUsd } from "@/lib/format";
import type { ScoreParts } from "@/lib/score";

export function ScoreBreakdown({ parts }: { parts: ScoreParts }) {
  const rows = [
    {
      k: parts.mcapSource === "airdrop" ? "Airdrop mcap" : "Circulating mcap",
      v: parts.airdrop,
      n: `${fmtUsd(parts.mcapUsed)} × 0.6`,
    },
    {
      k: "Burns",
      v: parts.burns,
      n: `${fmtCompact(parts.burnTokens)} $ANSEM × ${fmtUsd(parts.burnUsd && parts.burnTokens ? parts.burnUsd / parts.burnTokens : 0)} × 40`,
    },
    {
      k: "Boosts",
      v: parts.boosts,
      n: `${fmtCompact(parts.boostPoints)} pts × 250`,
    },
  ];
  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="type-eyebrow">Score</h2>
        <p className="font-mono text-xs tabular-nums text-ink">
          <LiveNum value={parts.total} format="compact" flash={false} />
        </p>
      </div>
      <p className="mt-2 max-w-[40rem] text-pretty text-sm text-muted">
        Published Crosscheck v1 — not z500.{" "}
        <Link href="/guide#score" className="text-ink hover:text-gold-lit">
          How this is scored
        </Link>
      </p>
      <div className="mt-4 divide-y divide-border border-t border-border">
        {rows.map((row) => (
          <div
            key={row.k}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] sm:gap-3"
          >
            <p className="truncate font-mono text-[12px] text-ink">{row.k}</p>
            <p className="col-span-2 min-w-0 text-pretty font-mono text-[11px] tabular-nums text-muted sm:col-span-1 sm:truncate">
              {row.n}
            </p>
            <p className="font-mono text-[12px] tabular-nums text-ink">
              <LiveNum value={row.v} format="compact" flash={false} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
