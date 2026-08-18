"use client";

import { timeAgo } from "@/lib/format";
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
