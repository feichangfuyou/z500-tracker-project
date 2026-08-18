const SNIPER_RE = /bundle|sniper|same.?block|insider/i;
export const INSIDER_WARN = 0.12;
export const INSIDER_BAD = 0.25;

export function concentrationFromHolderPcts(pcts: number[]) {
  const top10 = pcts.slice(0, 10).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  if (top10 <= 0) return null;
  return top10 / 100;
}

export type RugcheckReport = {
  graphInsidersDetected?: number;
  risks?: { name?: string; level?: string }[];
  topHolders?: { address?: string; owner?: string | null; pct?: number; insider?: boolean }[];
};

export type HolderRowLite = {
  address: string;
  owner?: string | null;
  pct: number;
  insider: boolean;
};

export type Radar = {
  top10Pct: number | null;
  insiderPct: number | null;
  sniper: boolean;
  clustered: boolean;
  holders: HolderRowLite[];
};

export function holdersFromRugcheck(json: RugcheckReport | null | undefined): HolderRowLite[] {
  return (json?.topHolders || [])
    .slice(0, 10)
    .map((h) => ({
      address: String(h.address || h.owner || ""),
      owner: h.owner || null,
      pct: Number(h.pct) || 0,
      insider: Boolean(h.insider),
    }))
    .filter((h) => h.address && h.pct > 0);
}

export function radarFromRugcheck(json: RugcheckReport | null | undefined): Radar {
  const holders = json?.topHolders || [];
  const top10Pct = concentrationFromHolderPcts(holders.map((h) => Number(h.pct)));
  const insiderRaw = holders
    .filter((h) => h.insider)
    .reduce((sum, h) => sum + (Number.isFinite(h.pct) ? Number(h.pct) : 0), 0);
  const insiderPct = insiderRaw > 0 ? insiderRaw / 100 : 0;
  const sniper = (json?.risks || []).some((r) => SNIPER_RE.test(r.name || ""));
  const clustered = (json?.graphInsidersDetected || 0) > 0 || insiderPct >= INSIDER_WARN;
  return {
    top10Pct,
    insiderPct: insiderPct > 0 ? insiderPct : null,
    sniper,
    clustered,
    holders: holdersFromRugcheck(json),
  };
}
