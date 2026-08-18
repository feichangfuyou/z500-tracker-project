"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function BurnVideo({
  playId,
  active,
  onEnded,
}: {
  playId: number;
  active: boolean;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(onEnded);

  useEffect(() => {
    endedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!active) {
      el.pause();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => endedRef.current(), 1200);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    el.muted = true;
    el.defaultMuted = true;
    el.volume = 0;

    const start = () => {
      if (cancelled) return;
      const play = el.play();
      if (play) play.catch(() => {
        if (!cancelled) endedRef.current();
      });
    };

    const onSeeked = () => start();
    if (el.ended || el.currentTime > 0.05) {
      el.addEventListener("seeked", onSeeked, { once: true });
      el.currentTime = 0;
    } else {
      start();
    }

    return () => {
      cancelled = true;
      el.removeEventListener("seeked", onSeeked);
    };
  }, [active, playId]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !active) return;
    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          visible = true;
          return;
        }
        if (!visible) return;
        el.pause();
        endedRef.current();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, playId]);

  return (
    <video
      ref={videoRef}
      className={cn("hero-banner__video", active ? "hero-banner__video--on" : null)}
      src="/brand/burn.mp4"
      muted
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
      disablePictureInPicture
      onEnded={() => endedRef.current()}
    />
  );
}
