import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function MiniStat({ k, v, className }: { k: string; v: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-th">{k}</dt>
      <dd className={cn("mt-0.5 truncate font-mono text-xs tabular-nums text-ink", className)}>{v}</dd>
    </div>
  );
}

export function MiniStatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("mt-3 grid grid-cols-2 gap-x-3 gap-y-2 min-[400px]:grid-cols-3 sm:grid-cols-6", className)}>{children}</dl>;
}

export function changeClass(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "text-dim";
  if (n > 0) return "text-good";
  if (n < 0) return "text-bad";
  return "text-ink";
}
