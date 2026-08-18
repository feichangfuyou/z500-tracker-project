import { fmtCompact } from "./format";
import type { BoostSeen, MintStatus, RankSnapshot, TapeEvent } from "./types";
import { activeBoost, type AnsemBoost } from "./ansem";

export const TAPE_MAX = 80;
export const HISTORY_MAX = 72;

export function pushTape(tape: TapeEvent[], events: TapeEvent[], max = TAPE_MAX) {
  if (!events.length) return tape;
  const seen = new Set<string>();
  const next: TapeEvent[] = [];
  for (const e of [...events, ...tape]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    next.push(e);
    if (next.length >= max) break;
  }
  return next;
}

export function pushHistory(history: RankSnapshot[], snap: RankSnapshot, max = HISTORY_MAX) {
  const last = history[0];
  if (last && last.at === snap.at) return history;
  return [snap, ...history].slice(0, max);
}

export function seriesForMint(history: RankSnapshot[], mint: string) {
  return [...history]
    .reverse()
    .filter((s) => s.ranks[mint] != null)
    .map((s) => ({
      at: s.at,
      rank: s.ranks[mint]!,
      officialRank: s.official?.[mint] ?? null,
    }));
}

type NamedCoin = {
  mint: string;
  name: string;
  ticker?: string | null;
  status?: string | null;
  slug?: string | null;
};

function tapeEvent(
  partial: Omit<TapeEvent, "slug"> & { slug?: string },
  coin: NamedCoin,
): TapeEvent {
  return coin.slug ? { ...partial, slug: coin.slug } : partial;
}

export function detectLaunches(seenMints: string[], coins: NamedCoin[], now = Date.now()): TapeEvent[] {
  if (!seenMints.length) return [];
  const seen = new Set(seenMints);
  return coins
    .filter((c) => c.mint && !seen.has(c.mint))
    .map((c) =>
      tapeEvent(
        {
          id: `launch:${c.mint}:${now}`,
          kind: "launch",
          at: now,
          mint: c.mint,
          name: c.name,
          ticker: c.ticker || undefined,
          label: `${c.ticker ? `$${c.ticker}` : c.name} just launched on ansem.io`,
        },
        c,
      ),
    );
}

export function detectMigrations(
  prev: MintStatus,
  coins: NamedCoin[],
  now = Date.now(),
): TapeEvent[] {
  if (!Object.keys(prev).length) return [];
  const events: TapeEvent[] = [];
  for (const c of coins) {
    const before = prev[c.mint];
    if (before === "on_curve" && c.status === "migrated") {
      events.push(
        tapeEvent(
          {
            id: `migrate:${c.mint}:${now}`,
            kind: "migrate",
            at: now,
            mint: c.mint,
            name: c.name,
            ticker: c.ticker || undefined,
            label: `${c.ticker ? `$${c.ticker}` : c.name} migrated off the curve`,
          },
          c,
        ),
      );
    }
  }
  return events;
}

export function snapshotStatuses(coins: NamedCoin[]): MintStatus {
  const next: MintStatus = {};
  for (const c of coins) next[c.mint] = c.status ?? null;
  return next;
}

export function burnEvents(
  hits: { signature: string; amount: number }[],
  coin: NamedCoin,
  now = Date.now(),
): TapeEvent[] {
  return hits
    .filter((h) => h.amount > 0)
    .map((h) =>
      tapeEvent(
        {
          id: `burn:${h.signature}`,
          kind: "burn",
          at: now,
          mint: coin.mint,
          name: coin.name,
          ticker: coin.ticker || undefined,
          amount: h.amount,
          label: `${coin.ticker ? `$${coin.ticker}` : coin.name} burned ${fmtCompact(h.amount)} $ANSEM`,
        },
        coin,
      ),
    );
}

export function burnDeltaEvent(delta: number, coin: NamedCoin, wallet: string, now = Date.now()): TapeEvent | null {
  if (!(delta > 0)) return null;
  return tapeEvent(
    {
      id: `burn:${wallet}:${now}`,
      kind: "burn",
      at: now,
      mint: coin.mint,
      name: coin.name,
      ticker: coin.ticker || undefined,
      amount: delta,
      label: `${coin.ticker ? `$${coin.ticker}` : coin.name} burned ${fmtCompact(delta)} $ANSEM`,
    },
    coin,
  );
}

export const BOOST_EXPIRING_MS = 30 * 60 * 1000;

type BoostCoin = NamedCoin & { slug: string };

export function snapshotBoosts(
  coins: BoostCoin[],
  boosts: Record<string, AnsemBoost | null | undefined>,
  prev: BoostSeen = {},
  now = Date.now(),
): BoostSeen {
  const next: BoostSeen = {};
  for (const c of coins) {
    const hit = activeBoost(boosts[c.slug], now);
    if (!hit) continue;
    const prior = prev[c.slug];
    next[c.slug] = {
      amount: hit.amount,
      expiresAt: hit.expiresAt,
      expiring: prior?.expiresAt === hit.expiresAt ? Boolean(prior.expiring) : false,
    };
  }
  return next;
}

export function detectBoostEvents(
  prev: BoostSeen,
  coins: BoostCoin[],
  boosts: Record<string, AnsemBoost | null | undefined>,
  now = Date.now(),
): { events: TapeEvent[]; next: BoostSeen } {
  const next = snapshotBoosts(coins, boosts, prev, now);
  if (!Object.keys(prev).length) return { events: [], next };

  const bySlug = new Map(coins.map((c) => [c.slug, c]));
  const events: TapeEvent[] = [];

  for (const c of coins) {
    const hit = activeBoost(boosts[c.slug], now);
    const before = prev[c.slug];
    const tag = c.ticker ? `$${c.ticker}` : c.name;
    if (hit && (!before || before.expiresAt !== hit.expiresAt)) {
      events.push(
        tapeEvent(
          {
            id: `boost:${c.slug}:${hit.expiresAt}:start`,
            kind: "boost",
            at: now,
            mint: c.mint,
            name: c.name,
            ticker: c.ticker || undefined,
            amount: hit.amount,
            label: `${tag} boosted ${hit.amount}`,
          },
          c,
        ),
      );
    }
    if (hit) {
      const exp = Date.parse(hit.expiresAt);
      const soon = Number.isFinite(exp) && exp - now <= BOOST_EXPIRING_MS && exp > now;
      if (soon && !before?.expiring) {
        events.push(
          tapeEvent(
            {
              id: `boost:${c.slug}:${hit.expiresAt}:expiring`,
              kind: "boost",
              at: now,
              mint: c.mint,
              name: c.name,
              ticker: c.ticker || undefined,
              amount: hit.amount,
              label: `${tag} boost expires soon`,
            },
            c,
          ),
        );
        next[c.slug] = { amount: hit.amount, expiresAt: hit.expiresAt, expiring: true };
      }
    }
  }

  for (const [slug, before] of Object.entries(prev)) {
    if (next[slug]) continue;
    const c = bySlug.get(slug);
    if (!c) continue;
    const tag = c.ticker ? `$${c.ticker}` : c.name;
    events.push(
      tapeEvent(
        {
          id: `boost:${slug}:${before.expiresAt}:end`,
          kind: "boost",
          at: now,
          mint: c.mint,
          name: c.name,
          ticker: c.ticker || undefined,
          label: `${tag} boost expired`,
        },
        c,
      ),
    );
  }

  return { events, next };
}
