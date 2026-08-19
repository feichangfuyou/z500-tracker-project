"use client";

import { fmtAge, timeAgo } from "@/lib/format";
import { useEffect, useState } from "react";

export function TimeAgo({
  at,
  prefix = "",
  empty = "",
  className,
}: {
  at: number | null | undefined;
  prefix?: string;
  empty?: string;
  className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!at) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [at]);

  if (!at) return empty ? <span className={className}>{empty}</span> : null;
  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      {timeAgo(at)}
    </span>
  );
}

/** Compact age (`47h 22m`). `now` must be a serialized snapshot so SSR and hydration match. */
export function LiveAge({
  at,
  now: syncedAt,
  className,
}: {
  at: number | null | undefined;
  now: number;
  className?: string;
}) {
  const [now, setNow] = useState(syncedAt);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return <span className={className}>{fmtAge(at, now)}</span>;
}
