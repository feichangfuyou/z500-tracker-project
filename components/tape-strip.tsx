"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LiveNum } from "@/components/live-num";
import { StatIcon, type StatIconName } from "@/components/stat-icon";
import { cn } from "@/lib/cn";
import { fmtCompact, timeAgo } from "@/lib/format";
import type { TapeEvent } from "@/lib/types";

const KIND_CLASS: Record<TapeEvent["kind"], string> = {
  burn: "text-bad",
  launch: "text-accent",
  boost: "text-good",
  migrate: "text-muted",
};

const KIND_ICON: Record<TapeEvent["kind"], StatIconName | null> = {
  burn: "flame",
  launch: "rocket",
  boost: "bolt",
  migrate: null,
};

export function TapeStrip({ events }: { events: TapeEvent[] }) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [duration, setDuration] = useState(36);
  const [, setTick] = useState(0);
  const shown = events.slice(0, 32);
  const animate = overflows && reduce === false;

  useEffect(() => {
    if (!shown.length) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [shown.length]);

  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !shown.length) return;
    const measure = () => {
      const copy = clip.querySelector<HTMLElement>("[data-tape-copy]");
      if (!copy) return;
      setOverflows(copy.scrollWidth > clip.clientWidth + 4);
      setDuration(Math.max(20, copy.scrollWidth / 38));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(clip);
    return () => ro.disconnect();
  }, [events, shown.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !animate) return;
    const sync = (on: boolean) => {
      if (on) el.removeAttribute("data-off");
      else el.setAttribute("data-off", "");
    };
    const io = new IntersectionObserver(([entry]) => {
      sync(Boolean(entry?.isIntersecting) && document.visibilityState === "visible");
    });
    io.observe(el);
    const onVis = () => sync(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [animate]);

  if (!events.length) {
    return (
      <p className="flex h-full items-center font-mono text-[11px] leading-none text-dim">
        No burns or launches in the scan window yet.
      </p>
    );
  }

  const copies = animate ? [0, 1] : [0];

  return (
    <div ref={rootRef} className="tape" aria-label="Live event tape">
      <div ref={clipRef} className={cn("tape-clip", animate && "tape-clip--fade")}>
        <div
          className={cn("tape-track", !animate && "tape-track--static")}
          style={{ "--tk-duration": `${duration}s` } as CSSProperties}
        >
          {copies.map((copy) => (
            <div
              key={copy}
              className="tape-track__copy"
              data-tape-copy={copy === 0 ? "" : undefined}
              aria-hidden={copy === 1 || undefined}
            >
              {shown.map((event) => (
                <TapeItem key={`${copy}-${event.id}`} event={event} live={copy === 0} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TapeItem({ event, live }: { event: TapeEvent; live: boolean }) {
  const name = event.ticker ? `$${event.ticker}` : event.name;
  const icon = KIND_ICON[event.kind];
  const amount =
    event.amount == null ? null : live ? (
      <LiveNum value={event.amount} format="compact" flash={false} />
    ) : (
      fmtCompact(event.amount)
    );
  const inner = (
    <>
      <span className={cn("inline-flex shrink-0 items-center gap-1 uppercase", KIND_CLASS[event.kind])}>
        {icon ? <StatIcon name={icon} className="size-3" /> : null}
        {event.kind}
      </span>
      <span className="tape-name max-w-[9rem] truncate text-ink">{name}</span>
      {amount != null ? (
        <span className={cn("shrink-0", event.kind === "burn" ? "text-gold-lit" : KIND_CLASS[event.kind])}>
          {amount}
        </span>
      ) : null}
      <span className="shrink-0 text-dim">{timeAgo(event.at) || "now"}</span>
      <span className="text-dim" aria-hidden>
        ·
      </span>
    </>
  );
  const className =
    "inline-flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px] leading-none tabular-nums";
  if (!live) {
    return <span className={className}>{inner}</span>;
  }
  return (
    <Link
      href={`/c/${event.mint}`}
      title={event.label}
      className={cn(className, "hover:[&_.tape-name]:text-gold-lit")}
    >
      {inner}
    </Link>
  );
}
