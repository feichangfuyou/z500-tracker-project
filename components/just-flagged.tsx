import Link from "next/link";
import { TimeAgo } from "@/components/time-ago";
import type { TapeEvent } from "@/lib/types";

export function justFlagged(events: TapeEvent[] | undefined) {
  return (events || []).filter((event) => event.kind === "flag" || event.kind === "rank").slice(0, 8);
}

export function JustFlagged({ events }: { events: TapeEvent[] }) {
  const rows = justFlagged(events);
  if (!rows.length) return null;
  return (
    <section className="mt-6 border border-border bg-panel px-4 py-3">
      <h2 className="type-eyebrow">Just flagged</h2>
      <ol className="mt-2 divide-y divide-border border-t border-border">
        {rows.map((event) => (
          <li key={event.id}>
            <Link href={`/c/${event.mint}`} className="flex items-baseline justify-between gap-3 py-2 hover:text-gold-lit">
              <span className="min-w-0 truncate text-sm text-ink">{event.label}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-dim">
                <TimeAgo at={event.at} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
