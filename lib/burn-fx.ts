export type BurnHit = { id: string; name: string; delta: number };

type BurnRow = { id: string; name: string; verifiedBurn: number | null };

export function snapshotBurns(projects: { id: string; verifiedBurn: number | null }[]): Record<string, number> {
  const next: Record<string, number> = {};
  for (const p of projects) next[p.id] = p.verifiedBurn ?? 0;
  return next;
}

/** Fresh listings with historical burns stay quiet. Only coins we already knew can ignite. */
export function burnIncreases(
  prev: Record<string, number>,
  projects: BurnRow[],
): { hits: BurnHit[]; next: Record<string, number> } {
  const hits: BurnHit[] = [];
  const next = { ...prev };
  for (const p of projects) {
    const amount = p.verifiedBurn ?? 0;
    const before = prev[p.id];
    if (before !== undefined && amount > before) {
      hits.push({ id: p.id, name: p.name, delta: amount - before });
    }
    next[p.id] = amount;
  }
  return { hits, next };
}

/** Manual verify: first confirmed amount (or a later increase) is a hit. */
export function applyBurnValue(
  prev: Record<string, number>,
  id: string,
  amount: number,
  name: string,
): { hit: BurnHit | null; next: Record<string, number> } {
  const before = prev[id] ?? 0;
  const next = { ...prev, [id]: amount };
  if (amount > before) return { hit: { id, name, delta: amount - before }, next };
  return { hit: null, next };
}

export function burnAnnounce(hit: BurnHit) {
  return `${hit.delta.toLocaleString(undefined, { maximumFractionDigits: 2 })} $ANSEM burned on ${hit.name}`;
}
