import Link from "next/link";
import { LiveNum } from "@/components/live-num";
import { cn } from "@/lib/cn";
import { ScrambleText } from "@/components/scramble-text";
import { RUBRIC_MARK, type Rubric, type RubricMark } from "@/lib/rubric";

function markClass(mark: RubricMark) {
  if (mark === "fail") return "text-bad";
  if (mark === "warn") return "text-gold-lit";
  if (mark === "pass") return "text-good";
  return "text-dim";
}

export function Scorecard({ rubric }: { rubric: Rubric }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="type-eyebrow">Scorecard</h2>
        <p className={cn("font-mono text-xs tabular-nums uppercase", markClass(rubric.mark))}>
          {rubric.label}
          {rubric.risk > 0 ? (
            <>
              {" · "}
              <LiveNum value={rubric.risk} format="int" flash={false} />
            </>
          ) : null}
        </p>
      </div>
      <p className="mt-2 max-w-[40rem] text-pretty text-sm text-muted">
        Checks we ran on this launch. Not a buy rating.{" "}
        <Link href="/guide#scorecard" className="text-ink hover:text-gold-lit">
          <ScrambleText text="How this is graded" />
        </Link>
        .
      </p>
      <div className="mt-4 divide-y divide-border border-t border-border">
        {rubric.rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,6.75rem)_3.25rem_minmax(0,1fr)] sm:gap-3"
          >
            <p className="truncate font-mono text-[12px] text-ink">{row.label}</p>
            <p className={cn("font-mono text-[11px] uppercase tabular-nums", markClass(row.mark))}>
              {RUBRIC_MARK[row.mark]}
            </p>
            <p className="col-span-2 min-w-0 text-pretty text-sm text-muted sm:col-span-1 sm:truncate">{row.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
