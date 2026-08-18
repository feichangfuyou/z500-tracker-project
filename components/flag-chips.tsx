import Link from "next/link";
import { LiveNum } from "@/components/live-num";
import { cn } from "@/lib/cn";
import { riskScore } from "@/lib/flags";
import type { Flag } from "@/lib/types";

export function FlagChips({
  flags,
  compact = false,
  walletHref,
  className,
}: {
  flags: Flag[];
  compact?: boolean;
  walletHref?: string | null;
  className?: string;
}) {
  if (!flags.length) return null;
  const risk = riskScore(flags);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        compact ? "max-w-full flex-wrap sm:flex-nowrap" : "max-w-full flex-wrap",
        className,
      )}
    >
      {!compact && risk >= 28 ? (
        <span className="font-mono text-[9px] uppercase tabular-nums text-bad">
          <LiveNum value={risk} format="int" flash={false} />
        </span>
      ) : null}
      {flags.slice(0, compact ? 2 : 6).map((f) => {
        const chipClass = cn(
          "inline-flex h-[17px] max-w-full shrink-0 items-center truncate whitespace-nowrap rounded-[5px] border px-1.5 font-mono text-[8.5px] font-semibold uppercase leading-none",
          f.severity === "bad" ? "border-bad-deep text-bad-lit" : "border-gold text-gold-lit",
        );
        if (f.id === "serial" && walletHref) {
          return (
            <Link
              key={f.id}
              href={`/wallets/${walletHref}`}
              aria-label={`${f.label} from this launch wallet`}
              className={chipClass}
            >
              <LiveFlagLabel flag={f} />
            </Link>
          );
        }
        return (
          <span key={f.id} className={chipClass}>
            <LiveFlagLabel flag={f} />
          </span>
        );
      })}
    </span>
  );
}

function LiveFlagLabel({ flag }: { flag: Flag }) {
  const pct = flag.label.match(/^(.*?)(\d+(?:\.\d+)?)%$/);
  if (pct) {
    return (
      <>
        {pct[1]}
        <LiveNum
          value={Number(pct[2])}
          format={(n) => (n == null || Number.isNaN(n) ? "" : `${Math.round(n)}%`)}
          flash={false}
        />
      </>
    );
  }
  const serial = flag.label.match(/^(\d+)( launch(?:es)?)$/i);
  if (serial) {
    return (
      <>
        <LiveNum value={Number(serial[1])} format="int" flash={false} />
        {serial[2]}
      </>
    );
  }
  return flag.label;
}
