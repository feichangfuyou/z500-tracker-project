import { INSIDER_BAD, INSIDER_WARN } from "./radar";
import { effectiveBurn } from "./score";
import type { Flag, Project, ProvenanceStatus } from "./types";
import { serialLabel, serialSeverity } from "./wallets";

export const MISMATCH_LABEL = "Listed ≠ create";

export function provenanceLabel(status: ProvenanceStatus | null | undefined) {
  if (status === "matched") return "Same wallet";
  if (status === "mismatch") return "Different wallet";
  return "Not checked";
}

export const TOP10_WARN = 0.55;
export const TOP10_BAD = 0.75;
export const LIQ_THIN = 3_000;
export const CLUSTER_MS = 30 * 60 * 1000;

type FlagInput = Pick<
  Project,
  | "walletProvenance"
  | "holderTop10Pct"
  | "insiderPct"
  | "sniper"
  | "live"
  | "status"
  | "tier"
  | "verifiedBurn"
  | "burnAmount"
  | "addedAt"
  | "launchCount"
>;

export function projectFlags(p: FlagInput, now = Date.now()): Flag[] {
  const flags: Flag[] = [];

  if (p.walletProvenance === "mismatch") {
    flags.push({ id: "mismatch", label: MISMATCH_LABEL, severity: "warn" });
  }

  if (p.sniper) {
    flags.push({ id: "sniper", label: "Bundle / sniper", severity: "bad" });
  }

  const serial = serialSeverity(p.launchCount || 0);
  if (serial) {
    flags.push({ id: "serial", label: serialLabel(p.launchCount || 0), severity: serial });
  }

  if (p.insiderPct != null && p.insiderPct >= INSIDER_WARN) {
    flags.push({
      id: "clustered",
      label: `Insiders ${(p.insiderPct * 100).toFixed(0)}%`,
      severity: p.insiderPct >= INSIDER_BAD ? "bad" : "warn",
    });
  }

  if (p.holderTop10Pct != null) {
    if (p.holderTop10Pct >= TOP10_BAD) {
      flags.push({ id: "top10", label: `Top 10 ${(p.holderTop10Pct * 100).toFixed(0)}%`, severity: "bad" });
    } else if (p.holderTop10Pct >= TOP10_WARN) {
      flags.push({ id: "top10", label: `Top 10 ${(p.holderTop10Pct * 100).toFixed(0)}%`, severity: "warn" });
    }
  }

  const liq = p.live?.liquidity;
  if ((p.status || "") === "migrated" && liq != null && liq > 0 && liq < LIQ_THIN) {
    flags.push({ id: "thinLiq", label: "Thin liquidity", severity: liq < 1_000 ? "bad" : "warn" });
  }

  if (p.burnAmount > 0 && p.verifiedBurn != null && p.verifiedBurn < p.burnAmount * 0.75) {
    flags.push({ id: "burnGap", label: "Burn below claim", severity: "bad" });
  }

  const paidTier = p.tier === "Gold" || p.tier === "Diamond";
  if (paidTier && p.verifiedBurn == null) {
    flags.push({ id: "unverified", label: "Burns unchecked", severity: "warn" });
  }
  if (paidTier && p.verifiedBurn === 0 && effectiveBurn(p) === 0) {
    flags.push({ id: "unverified", label: "No verified burn", severity: "warn" });
  }

  const young = p.addedAt > 0 && now - p.addedAt < CLUSTER_MS;
  if (!flags.some((f) => f.id === "clustered") && young && (p.holderTop10Pct ?? 0) >= TOP10_WARN) {
    flags.push({ id: "clustered", label: "Early concentration", severity: "warn" });
  }

  return flags;
}

export function riskScore(flags: Flag[]) {
  return Math.min(
    100,
    flags.reduce((sum, f) => sum + (f.severity === "bad" ? 28 : 16), 0),
  );
}
