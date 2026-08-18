export const WATCH_KEY = "z500-watched";
export const WATCH_WALLET_KEY = "z500-watch-wallet";
export const WATCH_MAX = 80;

export function parseWatchList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const mint = item.trim();
    if (mint.length < 32 || seen.has(mint)) continue;
    seen.add(mint);
    out.push(mint);
    if (out.length >= WATCH_MAX) break;
  }
  return out;
}

export function mergeWatches(...lists: string[][]) {
  return parseWatchList(lists.flat());
}
