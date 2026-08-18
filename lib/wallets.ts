import type { Flag, FlagSeverity, Project, ProvenanceStatus } from "./types";

export type WalletCoin = {
  mint: string;
  name: string;
  ticker?: string;
  slug?: string;
  tier: string;
  status?: string | null;
  score: number;
  officialRank: number | null;
  officialDelta: number | null;
  burned: number | null;
  airdropMcap: number | null;
  marketCap: number | null;
  change24h: number | null;
  boostPoints: number;
  boostGolden: boolean;
  addedAt: number;
  provenance?: ProvenanceStatus;
  flags: Flag[];
  imageUrl?: string | null;
};

export type WalletRow = {
  wallet: string;
  coins: WalletCoin[];
  burned: number;
  topTier: string;
  serial: FlagSeverity | null;
};

const TIER_RANK: Record<string, number> = {
  Diamond: 0,
  Gold: 1,
  Bronze: 2,
  Free: 3,
  Unranked: 4,
};

export const SERIAL_WARN = 5;
export const SERIAL_BAD = 8;

export function launchCounts(projects: { launchWallet: string | null }[]) {
  const counts = new Map<string, number>();
  for (const p of projects) {
    if (!p.launchWallet) continue;
    counts.set(p.launchWallet, (counts.get(p.launchWallet) || 0) + 1);
  }
  return counts;
}

export function serialSeverity(count: number): FlagSeverity | null {
  if (count >= SERIAL_BAD) return "bad";
  if (count >= SERIAL_WARN) return "warn";
  return null;
}

export function serialLabel(count: number) {
  return `${count} launch${count === 1 ? "" : "es"}`;
}

export function launchWallets(projects: Project[], opts?: { lite?: boolean }): WalletRow[] {
  const by = new Map<string, WalletRow>();
  for (const p of projects) {
    if (!p.launchWallet) continue;
    const row = by.get(p.launchWallet) || {
      wallet: p.launchWallet,
      coins: [],
      burned: 0,
      topTier: p.tier,
      serial: null,
    };
    row.coins.push({
      mint: p.mint,
      name: p.name,
      ticker: p.ticker,
      slug: p.slug,
      tier: p.tier,
      status: p.status ?? null,
      score: p.score,
      officialRank: p.officialRank,
      officialDelta: p.officialDelta,
      burned: p.verifiedBurn,
      airdropMcap: p.live?.airdropMcap ?? null,
      marketCap: p.live?.marketCap ?? null,
      change24h: p.live?.change24h ?? null,
      boostPoints: p.boostPoints || 0,
      boostGolden: p.boostGolden,
      addedAt: p.addedAt,
      provenance: p.walletProvenance,
      flags: opts?.lite ? [] : p.flags,
      imageUrl: opts?.lite ? null : p.imageUrl,
    });
    row.burned = Math.max(row.burned, p.verifiedBurn || 0);
    if ((TIER_RANK[p.tier] ?? 9) < (TIER_RANK[row.topTier] ?? 9)) row.topTier = p.tier;
    by.set(p.launchWallet, row);
  }
  for (const row of by.values()) {
    row.serial = serialSeverity(row.coins.length);
    row.coins.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }
  return [...by.values()].sort(
    (a, b) =>
      (TIER_RANK[a.topTier] ?? 9) - (TIER_RANK[b.topTier] ?? 9) ||
      b.coins.length - a.coins.length ||
      b.burned - a.burned,
  );
}

export function findWallet(projects: Project[], wallet: string): WalletRow | null {
  if (!wallet) return null;
  return launchWallets(projects.filter((p) => p.launchWallet === wallet))[0] ?? null;
}

export function isKnownLaunchWallet(projects: { launchWallet: string | null }[], wallet: string) {
  return Boolean(wallet) && projects.some((p) => p.launchWallet === wallet);
}

export function walletAirdropUsd(row: WalletRow) {
  return row.coins.reduce((sum, c) => sum + (c.airdropMcap || 0), 0);
}

export function walletBestOfficial(row: WalletRow) {
  return row.coins.reduce<number | null>((best, c) => {
    if (c.officialRank == null) return best;
    if (best == null || c.officialRank < best) return c.officialRank;
    return best;
  }, null);
}

export function walletMismatchCount(row: WalletRow) {
  return row.coins.filter((c) => c.provenance === "mismatch" || c.flags.some((f) => f.id === "mismatch")).length;
}

export function walletLedger(rows: WalletRow[]) {
  let launches = 0;
  let serial = 0;
  let diamond = 0;
  let gold = 0;
  for (const row of rows) {
    launches += row.coins.length;
    if (row.serial) serial += 1;
    if (row.topTier === "Diamond") diamond += 1;
    else if (row.topTier === "Gold") gold += 1;
  }
  return { wallets: rows.length, launches, serial, diamond, gold };
}
