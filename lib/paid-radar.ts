import { fmtCompact } from "./format";
import { ansemCoinUrl } from "./links";
import { publicBurn } from "./score";
import type { FlagSeverity, Project } from "./types";
import { serialLabel, serialSeverity } from "./wallets";

/** ansem.io docs, 18 Aug 2026: Gold ~92,627 $ANSEM, Diamond ~370,508. */
export const GOLD_BURN = 92_627;
export const DIAMOND_BURN = 370_508;

export type RadarReasonId = "pending" | "partial" | "short" | "mismatch" | "serial" | "sniper";

export type RadarReason = {
  id: RadarReasonId;
  label: string;
  severity: FlagSeverity;
};

export type RadarRow = {
  mint: string;
  name: string;
  ticker?: string;
  slug?: string | null;
  tier: "Gold" | "Diamond";
  imageUrl?: string | null;
  launchWallet: string | null;
  verifiedBurn: number | null;
  verifyExhausted: boolean;
  floor: number;
  officialRank: number | null;
  reasons: RadarReason[];
  ansemUrl: string | null;
};

export type RadarStats = {
  paid: number;
  flagged: number;
  burnGaps: number;
  mismatch: number;
  serial: number;
  sniper: number;
};

const BURN_IDS = new Set<RadarReasonId>(["pending", "partial", "short"]);

export function isPaidTier(tier: string): tier is "Gold" | "Diamond" {
  return tier === "Gold" || tier === "Diamond";
}

export function looksDoubledBurn(amount: number | null | undefined) {
  if (!(amount && amount > 0)) return false;
  const near = (value: number, floor: number) => Math.abs(value - floor) < 0.5;
  if (near(amount, DIAMOND_BURN) || near(amount, GOLD_BURN)) return false;
  for (const floor of [DIAMOND_BURN, GOLD_BURN]) {
    const n = amount / floor;
    const rounded = Math.round(n);
    if (rounded >= 2 && Math.abs(n - rounded) < 1e-6) return true;
  }
  return false;
}

export function tierBurnFloor(tier: string): number | null {
  if (tier === "Diamond") return DIAMOND_BURN;
  if (tier === "Gold") return GOLD_BURN;
  return null;
}

function burnReasons(p: Pick<Project, "tier" | "verifiedBurn" | "verifyExhausted" | "listedBurn">): RadarReason[] {
  const floor = tierBurnFloor(p.tier);
  const burned = publicBurn(p);
  if (floor == null) return [];
  if (p.verifiedBurn == null && p.listedBurn == null) {
    return [{ id: "pending", label: "Burns pending", severity: "warn" }];
  }
  if (burned >= floor) return [];
  if (!p.verifyExhausted && p.listedBurn == null) {
    return [
      {
        id: "partial",
        label: `Still scanning · ${fmtCompact(p.verifiedBurn)} of ${fmtCompact(floor)} ${p.tier}`,
        severity: "warn",
      },
    ];
  }
  return [
    {
      id: "short",
      label:
        burned === 0
          ? `No verified burn · ${p.tier} is ${fmtCompact(floor)}`
          : `${fmtCompact(burned)} of ${fmtCompact(floor)} ${p.tier}`,
      severity: burned === 0 ? "bad" : "warn",
    },
  ];
}

export function radarReasons(
  p: Pick<Project, "tier" | "verifiedBurn"> &
    Partial<Pick<Project, "verifyExhausted" | "listedBurn" | "walletProvenance" | "sniper" | "launchCount">>,
): RadarReason[] {
  const reasons = burnReasons(p);
  if (p.sniper) {
    reasons.push({ id: "sniper", label: "Bundle / sniper", severity: "bad" });
  }
  const serial = serialSeverity(p.launchCount || 0);
  if (serial) {
    reasons.push({ id: "serial", label: serialLabel(p.launchCount || 0), severity: serial });
  }
  return reasons;
}

function reasonWeight(row: RadarRow) {
  if (row.reasons.some((r) => r.severity === "bad")) return 0;
  if (row.reasons.some((r) => r.id === "short" || r.id === "sniper")) return 1;
  return 2;
}

export function paidRadar(projects: Project[]): RadarRow[] {
  const rows: RadarRow[] = [];
  for (const p of projects) {
    if (!isPaidTier(p.tier)) continue;
    const floor = tierBurnFloor(p.tier);
    if (floor == null) continue;
    const reasons = radarReasons(p);
    if (!reasons.length) continue;
    rows.push({
      mint: p.mint,
      name: p.name,
      ticker: p.ticker,
      slug: p.slug,
      tier: p.tier,
      imageUrl: p.imageUrl,
      launchWallet: p.launchWallet,
      verifiedBurn: publicBurn(p),
      verifyExhausted: Boolean(p.verifyExhausted),
      floor,
      officialRank: p.officialRank,
      reasons,
      ansemUrl: ansemCoinUrl(p.slug),
    });
  }
  return rows.sort(
    (a, b) =>
      reasonWeight(a) - reasonWeight(b) ||
      (a.tier === "Diamond" ? 0 : 1) - (b.tier === "Diamond" ? 0 : 1) ||
      (a.officialRank ?? 9_999) - (b.officialRank ?? 9_999) ||
      a.name.localeCompare(b.name),
  );
}

export function radarStats(projects: Project[], rows = paidRadar(projects)): RadarStats {
  return {
    paid: projects.filter((p) => isPaidTier(p.tier)).length,
    flagged: rows.length,
    burnGaps: rows.filter((r) => r.reasons.some((x) => BURN_IDS.has(x.id))).length,
    mismatch: rows.filter((r) => r.reasons.some((x) => x.id === "mismatch")).length,
    serial: rows.filter((r) => r.reasons.some((x) => x.id === "serial")).length,
    sniper: rows.filter((r) => r.reasons.some((x) => x.id === "sniper")).length,
  };
}

export function publicRadarRow(row: RadarRow) {
  return {
    mint: row.mint,
    name: row.name,
    ticker: row.ticker || null,
    tier: row.tier,
    burned: row.verifiedBurn,
    burnedComplete: row.verifyExhausted,
    floor: row.floor,
    listedRank: row.officialRank,
    reasons: row.reasons.map((r) => r.id),
    flags: row.reasons.map((r) => r.label),
    ansemUrl: row.ansemUrl,
  };
}
