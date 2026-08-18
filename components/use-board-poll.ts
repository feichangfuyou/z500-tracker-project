"use client";

import { useEffect } from "react";
import type { BoardResponse } from "@/lib/types";

export const POLL_MS = 30_000;

export function useBoardPoll(onBoard: (board: BoardResponse) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/board?lite=1");
        if (!res.ok) return;
        const json = (await res.json()) as BoardResponse;
        if (alive) onBoard(json);
      } catch {
        /* keep last snapshot */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [onBoard, enabled]);
}
