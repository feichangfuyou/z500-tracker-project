import { fmtCompact, fmtUsd } from "./format";
import { LIQ_THIN, TOP10_BAD, TOP10_WARN, projectFlags, riskScore } from "./flags";
import { INSIDER_BAD, INSIDER_WARN } from "./radar";
import type { Project } from "./types";
import { SERIAL_BAD, SERIAL_WARN } from "./wallets";

export type RubricMark = "pass" | "warn" | "fail" | "unchecked";
export type RubricId = "wallet" | "burns" | "holders" | "insiders" | "snipers" | "serial" | "liquidity";

export type RubricRow = {
  id: RubricId;
  label: string;
  mark: RubricMark;
  note: string;
};

export type Rubric = {
  mark: RubricMark;
  label: string;
  risk: number;
  rows: RubricRow[];
};

export type RubricInput = Pick<
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
  | "launchWallet"
>;

export type RubricDossier = {
  sameBlockWallets?: number;
  sniper?: boolean;
} | null;

export const RUBRIC_MARK: Record<RubricMark, string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
  unchecked: "—",
};

export const RUBRIC_OVERALL: Record<RubricMark, string> = {
  pass: "Clear",
  warn: "Caution",
  fail: "Flagged",
  unchecked: "Incomplete",
};

const MIN_CLEAR = 3;

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function overallMark(rows: RubricRow[]): RubricMark {
  if (rows.some((r) => r.mark === "fail")) return "fail";
  if (rows.some((r) => r.mark === "warn")) return "warn";
  const passed = rows.filter((r) => r.mark === "pass");
  if (passed.length >= MIN_CLEAR) return "pass";
  return "unchecked";
}

function walletRow(p: RubricInput): RubricRow {
  if (p.walletProvenance === "mismatch") {
    return { id: "wallet", label: "Wallet", mark: "fail", note: "Listed wallet did not create the mint" };
  }
  if (p.walletProvenance === "matched") {
    return { id: "wallet", label: "Wallet", mark: "pass", note: "Listed wallet created the mint" };
  }
  return { id: "wallet", label: "Wallet", mark: "unchecked", note: "Not checked yet" };
}

function burnsRow(p: RubricInput): RubricRow {
  const paid = p.tier === "Gold" || p.tier === "Diamond";
  if (p.burnAmount > 0 && p.verifiedBurn != null && p.verifiedBurn < p.burnAmount * 0.75) {
    return {
      id: "burns",
      label: "Burns",
      mark: "fail",
      note: `On-chain ${fmtCompact(p.verifiedBurn)} vs claimed ${fmtCompact(p.burnAmount)}`,
    };
  }
  if (paid && p.verifiedBurn == null) {
    return { id: "burns", label: "Burns", mark: "warn", note: "Gold/Diamond, not scanned yet" };
  }
  if (paid && p.verifiedBurn === 0) {
    return { id: "burns", label: "Burns", mark: "warn", note: "No verified $ANSEM burn" };
  }
  if (p.verifiedBurn != null && p.verifiedBurn > 0) {
    return { id: "burns", label: "Burns", mark: "pass", note: `${fmtCompact(p.verifiedBurn)} $ANSEM verified` };
  }
  if (p.verifiedBurn === 0) {
    return { id: "burns", label: "Burns", mark: "pass", note: "None in the scanned window" };
  }
  return { id: "burns", label: "Burns", mark: "unchecked", note: "Not scanned yet" };
}

function holdersRow(p: RubricInput): RubricRow {
  const share = p.holderTop10Pct;
  if (share == null) {
    return { id: "holders", label: "Holders", mark: "unchecked", note: "Not pulled yet" };
  }
  if (share >= TOP10_BAD) {
    return { id: "holders", label: "Holders", mark: "fail", note: `Top 10 hold ${pct(share)}` };
  }
  if (share >= TOP10_WARN) {
    return { id: "holders", label: "Holders", mark: "warn", note: `Top 10 hold ${pct(share)}` };
  }
  return { id: "holders", label: "Holders", mark: "pass", note: `Top 10 hold ${pct(share)}` };
}

function insidersRow(p: RubricInput): RubricRow {
  const share = p.insiderPct;
  if (share != null && share >= INSIDER_BAD) {
    return { id: "insiders", label: "Insiders", mark: "fail", note: `${pct(share)} labeled insider` };
  }
  if (share != null && share >= INSIDER_WARN) {
    return { id: "insiders", label: "Insiders", mark: "warn", note: `${pct(share)} labeled insider` };
  }
  if (share != null) {
    return { id: "insiders", label: "Insiders", mark: "pass", note: share > 0 ? `${pct(share)} labeled insider` : "None labeled" };
  }
  if (p.holderTop10Pct != null) {
    return { id: "insiders", label: "Insiders", mark: "pass", note: "None labeled" };
  }
  return { id: "insiders", label: "Insiders", mark: "unchecked", note: "Not pulled yet" };
}

function snipersRow(p: RubricInput, dossier: RubricDossier): RubricRow {
  const sniper = Boolean(p.sniper || dossier?.sniper);
  if (sniper) {
    const n = dossier?.sameBlockWallets;
    return {
      id: "snipers",
      label: "Snipers",
      mark: "fail",
      note: n ? `${n} wallets in the create slot` : "Bundle / sniper flagged",
    };
  }
  if (dossier) {
    return {
      id: "snipers",
      label: "Snipers",
      mark: "pass",
      note: `${dossier.sameBlockWallets ?? 0} wallets in the create slot`,
    };
  }
  if (p.sniper === false) {
    return { id: "snipers", label: "Snipers", mark: "pass", note: "No bundle flag" };
  }
  return { id: "snipers", label: "Snipers", mark: "unchecked", note: "Not checked yet" };
}

function serialRow(p: RubricInput): RubricRow {
  const count = p.launchCount || (p.launchWallet ? 1 : 0);
  if (count >= SERIAL_BAD) {
    return { id: "serial", label: "Serial", mark: "fail", note: `${count} launches from this wallet` };
  }
  if (count >= SERIAL_WARN) {
    return { id: "serial", label: "Serial", mark: "warn", note: `${count} launches from this wallet` };
  }
  if (count >= 1) {
    return {
      id: "serial",
      label: "Serial",
      mark: "pass",
      note: count === 1 ? "One launch on this board" : `${count} launches from this wallet`,
    };
  }
  return { id: "serial", label: "Serial", mark: "unchecked", note: "No launch wallet" };
}

function liquidityRow(p: RubricInput): RubricRow {
  const liq = p.live?.liquidity;
  const migrated = (p.status || "") === "migrated";
  if (migrated && liq != null && liq > 0 && liq < 1_000) {
    return { id: "liquidity", label: "Liquidity", mark: "fail", note: `${fmtUsd(liq)} pool` };
  }
  if (migrated && liq != null && liq > 0 && liq < LIQ_THIN) {
    return { id: "liquidity", label: "Liquidity", mark: "warn", note: `${fmtUsd(liq)} pool` };
  }
  if (migrated && liq != null && liq >= LIQ_THIN) {
    return { id: "liquidity", label: "Liquidity", mark: "pass", note: `${fmtUsd(liq)} pool` };
  }
  if (migrated) {
    return { id: "liquidity", label: "Liquidity", mark: "unchecked", note: "No pool figure yet" };
  }
  return { id: "liquidity", label: "Liquidity", mark: "unchecked", note: "Still on the curve" };
}

export function projectRubric(p: RubricInput, dossier: RubricDossier = null, now = Date.now()): Rubric {
  const rows = [
    walletRow(p),
    burnsRow(p),
    holdersRow(p),
    insidersRow(p),
    snipersRow(p, dossier),
    serialRow(p),
    liquidityRow(p),
  ];
  const mark = overallMark(rows);
  return {
    mark,
    label: RUBRIC_OVERALL[mark],
    risk: riskScore(projectFlags(p, now)),
    rows,
  };
}
