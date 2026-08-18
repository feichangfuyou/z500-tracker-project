"use client";

import { motion, useReducedMotion } from "motion/react";
import { LiveNum } from "@/components/live-num";
import { seriesPoints, sparkPath, sparkScale } from "@/lib/spark";
import type { RankPoint } from "@/lib/types";

const W = 320;
const H = 72;
const PAD = 6;

export function RankSparkline({ points }: { points: RankPoint[] }) {
  const reduce = useReducedMotion();
  if (points.length < 2) return null;
  const ranks = points.map((p) => p.rank);
  const official = points.map((p) => p.officialRank);
  const { min, max } = sparkScale([...ranks, ...official.filter((n): n is number => n != null)]);
  const cross = seriesPoints(ranks, W, H, PAD, min, max);
  const listed = seriesPoints(official, W, H, PAD, min, max);
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const label = `Crosscheck rank moved from #${first.rank} to #${last.rank}${
    last.officialRank != null ? `. Listed now #${last.officialRank}` : ""
  }.`;
  const draw = reduce ? { duration: 0 } : { duration: 0.7, ease: "easeOut" as const };

  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full max-w-[20rem] text-ink"
        role="img"
        aria-label={label}
      >
        <motion.path
          d={sparkPath(listed)}
          fill="none"
          stroke="currentColor"
          className="text-dim"
          strokeWidth="1.5"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={draw}
        />
        <motion.path
          d={sparkPath(cross)}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth="1.75"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={draw}
        />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-muted">
        <span>
          <span className="text-accent">Crosscheck</span>{" "}
          <LiveNum value={last.rank} format="rank" />
        </span>
        {last.officialRank != null && (
          <span>
            <span className="text-dim">Listed</span>{" "}
            <LiveNum value={last.officialRank} format="rank" />
          </span>
        )}
      </figcaption>
    </figure>
  );
}
