import { BASE58 } from "./format";
import { ADD_RATE_LIMIT, ADD_RATE_WINDOW_MS, REPORT_HIDE_THRESHOLD } from "./types";

export type AddLogEntry = { sid: string; ip: string; at: number };

export function isValidAddress(value: string) {
  return BASE58.test(value.trim());
}

export function pruneAddLog(log: AddLogEntry[], now = Date.now(), windowMs = ADD_RATE_WINDOW_MS) {
  return log.filter((e) => now - e.at < windowMs);
}

export function addHits(log: AddLogEntry[], sid: string, ip: string) {
  return log.filter((e) => e.sid === sid || e.ip === ip).length;
}

export function overAddLimit(hits: number, limit = ADD_RATE_LIMIT) {
  return hits >= limit;
}

export function isDuplicateMint(existing: string[], mint: string) {
  return existing.includes(mint);
}

export function shouldHideFromReports(reports: number, threshold = REPORT_HIDE_THRESHOLD) {
  return reports >= threshold;
}

export function matchLaunchWallet(
  launchWallet: string | null | undefined,
  onchain?: string | null,
  pump?: string | null,
) {
  if (!launchWallet) return "unknown" as const;
  if (onchain) return onchain === launchWallet ? ("matched" as const) : ("mismatch" as const);
  if (pump) return pump === launchWallet ? ("matched" as const) : ("unknown" as const);
  return "unknown" as const;
}
