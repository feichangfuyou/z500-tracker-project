"use client";

import { useCallback } from "react";
import { mergeWatches, parseWatchList, WATCH_KEY, WATCH_WALLET_KEY } from "@/lib/watch";

export function loadLocalWatches(): string[] {
  try {
    return parseWatchList(JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function loadWatchWallet(): string {
  try {
    return localStorage.getItem(WATCH_WALLET_KEY) || "";
  } catch {
    return "";
  }
}

export function saveLocalWatches(mints: string[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(mints));
}

export function saveWatchWallet(wallet: string) {
  if (wallet) localStorage.setItem(WATCH_WALLET_KEY, wallet);
  else localStorage.removeItem(WATCH_WALLET_KEY);
}

export async function pullWatches(local = loadLocalWatches(), wallet = loadWatchWallet()) {
  const res = await fetch(`/api/watch${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`);
  if (!res.ok) return local;
  const json = (await res.json()) as { mints?: string[] };
  const merged = mergeWatches(local, json.mints || []);
  saveLocalWatches(merged);
  return merged;
}

export async function pushWatches(mints: string[], wallet = loadWatchWallet()) {
  saveLocalWatches(mints);
  await fetch("/api/watch", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mints, wallet: wallet || undefined }),
  }).catch(() => undefined);
}

export function useWatchSync(setWatched: (mints: string[]) => void) {
  return useCallback(async () => {
    const merged = await pullWatches().catch(() => loadLocalWatches());
    setWatched(merged);
    await pushWatches(merged);
  }, [setWatched]);
}
