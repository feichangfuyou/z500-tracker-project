import { isPaidTier } from "./paid-radar";
import type { TapeEvent } from "./types";

export type AlertContext = {
  watchMints: Set<string>;
  paidMints: Set<string>;
};

export function parseAlertFilter(raw = process.env.ALERT_FILTER) {
  const value = (raw || "watch,radar").trim().toLowerCase();
  if (value === "all") return "all" as const;
  return "watch,radar" as const;
}

export function watchMintsFromLists(watches: Record<string, string[]> | undefined) {
  const mints = new Set<string>();
  for (const list of Object.values(watches || {})) {
    for (const mint of list) {
      if (mint) mints.add(mint);
    }
  }
  return mints;
}

export function paidMintsFromCoins(coins: { mint: string; tier?: string }[]) {
  const mints = new Set<string>();
  for (const coin of coins) {
    if (coin.mint && isPaidTier(coin.tier || "")) mints.add(coin.mint);
  }
  return mints;
}

export function alertContext(opts: {
  watches?: Record<string, string[]>;
  coins?: { mint: string; tier?: string }[];
}): AlertContext {
  return {
    watchMints: watchMintsFromLists(opts.watches),
    paidMints: paidMintsFromCoins(opts.coins || []),
  };
}

export function tapeForAlerts(
  events: TapeEvent[],
  ctx: AlertContext,
  filter = parseAlertFilter(),
) {
  if (filter === "all") return events;
  return events.filter((event) => {
    if (event.kind === "flag") return true;
    if (ctx.watchMints.has(event.mint)) return true;
    if (ctx.paidMints.has(event.mint)) return true;
    return false;
  });
}
