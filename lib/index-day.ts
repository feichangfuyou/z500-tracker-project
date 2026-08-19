import { isIndexMint, type Flag, type IndexCoin, type IndexDay, type Project } from "./types";

export type { IndexDay };

export const INDEX_SIZE = 25;
export const INDEX_KEEP = 30;

export function utcDayStart(at: number) {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function utcDayLabel(at: number) {
  return new Date(at).toISOString().slice(0, 10);
}

export type IndexInput = {
  mint: string;
  name: string;
  ticker?: string;
  score: number;
  officialRank: number | null;
  airdropMcap: number | null;
  burned: number | null;
  imageUrl?: string | null;
  marketCap?: number | null;
  change24h?: number | null;
  tier?: string;
  status?: string | null;
  flags?: Flag[];
};

export function indexInputFromProject(p: Project): IndexInput {
  return {
    mint: p.mint,
    name: p.name,
    ticker: p.ticker,
    score: p.score,
    officialRank: p.officialRank,
    airdropMcap: p.live?.airdropMcap ?? null,
    burned: p.verifiedBurn,
    imageUrl: p.imageUrl,
    marketCap: p.live?.marketCap ?? null,
    change24h: p.live?.change24h ?? null,
    tier: p.tier,
    status: p.status ?? null,
    flags: p.flags,
  };
}

export function indexFromProjects(projects: Project[], at = Date.now()): IndexDay {
  return buildIndexDay(projects.filter((p) => !isIndexMint(p.mint)).map(indexInputFromProject), at);
}

export function overlayLiveIndex(snapshot: IndexDay, live: IndexDay | null): IndexDay {
  if (!live || live.at !== snapshot.at) return snapshot;
  const by = new Map(live.coins.map((c) => [c.mint, c]));
  return {
    at: snapshot.at,
    coins: snapshot.coins.map((c) => {
      const hit = by.get(c.mint);
      if (!hit) return c;
      return {
        ...c,
        imageUrl: hit.imageUrl ?? c.imageUrl,
        marketCap: hit.marketCap ?? c.marketCap,
        change24h: hit.change24h ?? c.change24h,
        flags: hit.flags?.length ? hit.flags : c.flags,
        tier: hit.tier ?? c.tier,
        status: hit.status ?? c.status,
      };
    }),
  };
}

export function buildIndexDay(projects: IndexInput[], at = Date.now()): IndexDay {
  const coins: IndexCoin[] = [...projects]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, INDEX_SIZE)
    .map((p) => ({
      mint: p.mint,
      name: p.name,
      ticker: p.ticker,
      score: p.score,
      officialRank: p.officialRank,
      airdropMcap: p.airdropMcap,
      burned: p.burned,
      imageUrl: p.imageUrl,
      marketCap: p.marketCap,
      change24h: p.change24h,
      tier: p.tier,
      status: p.status,
      flags: p.flags,
    }));
  return { at: utcDayStart(at), coins };
}

export function pushIndexDay(days: IndexDay[], next: IndexDay, keep = INDEX_KEEP) {
  const without = days.filter((d) => d.at !== next.at);
  return [next, ...without].sort((a, b) => b.at - a.at).slice(0, keep);
}

export function previousIndexDay(days: IndexDay[] | undefined, at = Date.now()) {
  const start = utcDayStart(at);
  return (days || []).find((d) => d.at < start) || null;
}

/** Positive = climbed vs yesterday's Crosscheck top 25. */
export function dayRankDelta(currentRank: number, yesterday: IndexDay | null | undefined, mint: string) {
  if (!yesterday?.coins.length || !(currentRank > 0)) return 0;
  const prev = yesterday.coins.findIndex((c) => c.mint === mint);
  if (prev < 0) {
    return currentRank <= INDEX_SIZE ? INDEX_SIZE + 1 - currentRank : 0;
  }
  return prev + 1 - currentRank;
}
