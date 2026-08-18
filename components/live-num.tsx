"use client";

import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtCompact, fmtHoldPct, fmtInt, fmtNum, fmtPct, fmtPrice, fmtRank, fmtUsd } from "@/lib/format";

const FORMATS = {
  usd: fmtUsd,
  price: fmtPrice,
  num: fmtNum,
  compact: fmtCompact,
  pct: fmtPct,
  holdPct: fmtHoldPct,
  rank: fmtRank,
  int: fmtInt,
} as const;

export type LiveNumFormatName = keyof typeof FORMATS;
export type LiveNumFormat = LiveNumFormatName | ((n: number | null | undefined) => string);

function resolveFormat(format: LiveNumFormat) {
  return typeof format === "string" ? FORMATS[format] : format;
}

const REEL = "0123456789";
const TWEEN_S = 0.7;

function isDigit(ch: string) {
  return ch >= "0" && ch <= "9";
}

function isNil(n: number | null | undefined): n is null | undefined {
  return n === null || n === undefined || Number.isNaN(n);
}

export function Odo({ value, className }: { value: string; className?: string }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span className={cn("odo", armed && "odo--armed", className)} aria-label={value}>
      {Array.from(value).map((ch, i) =>
        isDigit(ch) ? (
          <span key={`${value.length}:${i}`} className="odo__d" aria-hidden>
            <span className="odo__r" style={{ transform: `translate3d(0, ${-Number(ch)}lh, 0)` }}>
              {Array.from(REEL).map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={`${value.length}:${i}:${ch}`} className="odo__s" aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

export function LiveNum({
  value,
  format,
  className,
  reel = false,
  flash = true,
}: {
  value: number | null | undefined;
  format: LiveNumFormat;
  className?: string;
  reel?: boolean;
  flash?: boolean;
}) {
  const reduce = useReducedMotion();
  const target = isNil(value) ? null : value;
  const mv = useMotionValue(target ?? 0);
  const [tweened, setTweened] = useState(target ?? 0);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const prev = useRef(target);

  useMotionValueEvent(mv, "change", (v) => setTweened(v));

  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (target == null) return;

    if (reduce || reel) {
      mv.set(target);
      return;
    }

    let flashed = false;
    const controls = animate(mv, target, {
      duration: TWEEN_S,
      ease: "easeOut",
      onUpdate: () => {
        if (flashed || !flash || from == null || from === target) return;
        flashed = true;
        setDir(target > from ? "up" : "down");
      },
    });
    const t = window.setTimeout(() => setDir(null), TWEEN_S * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(t);
    };
  }, [target, reduce, reel, flash, mv]);

  const shown = target == null || reduce || reel ? target : tweened;
  const label = resolveFormat(format)(shown);
  const cls = cn(
    "tabular-nums",
    flash && "live-num",
    dir === "up" && "live-num--up",
    dir === "down" && "live-num--down",
    className,
  );

  if (reel) return <Odo value={label} className={cls} />;
  return <span className={cls}>{label}</span>;
}

export function LiveShift({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value == null || Number.isNaN(value) || value === 0) return null;
  return (
    <span className={cn("whitespace-nowrap", value > 0 ? "text-good" : "text-bad", className)}>
      <LiveNum
        value={value}
        format={(n) => {
          if (n == null || Number.isNaN(n) || Math.round(n) === 0) return "";
          return n > 0 ? `↑${Math.round(n)}` : `↓${Math.round(Math.abs(n))}`;
        }}
        flash={false}
      />
    </span>
  );
}
