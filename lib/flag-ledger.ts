import { FLAG_OUTCOMES, ISSUED_FLAG_TYPES, type FlagIssued, type FlagOutcome, type IssuedFlagType, type TapeEvent } from "./types";

export const FLAG_LEDGER_MAX = 400;
export const FLAG_RESOLVE_MS = 14 * 24 * 60 * 60 * 1000;

const SERIAL_ID = /^flag:serial:(.+):(\d+)$/;

export function flagFromTape(event: TapeEvent, now = Date.now()): FlagIssued | null {
  if (event.kind !== "flag") return null;
  const match = event.id.match(SERIAL_ID);
  if (!match) return null;
  const wallet = event.wallet || match[1] || "";
  const threshold = Number(match[2]);
  if (!wallet || !event.mint || !Number.isFinite(threshold)) return null;
  const issuedAt = event.at || now;
  return {
    id: event.id,
    wallet,
    mint: event.mint,
    name: event.name,
    ticker: event.ticker,
    slug: event.slug,
    flagType: "serial",
    threshold,
    launchCount: event.amount && event.amount > 0 ? event.amount : threshold,
    issuedAt,
    resolutionDueAt: issuedAt + FLAG_RESOLVE_MS,
    outcome: null,
    outcomeResolvedAt: null,
  };
}

export function issueFlags(ledger: FlagIssued[] | undefined, events: TapeEvent[], now = Date.now()): FlagIssued[] {
  const prev = ledger || [];
  const fresh: FlagIssued[] = [];
  for (const event of events) {
    const row = flagFromTape(event, now);
    if (row) fresh.push(row);
  }
  if (!fresh.length) return trimFlagLedger(prev);
  const byId = new Map<string, FlagIssued>();
  for (const row of prev) byId.set(row.id, row);
  for (const row of fresh) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return trimFlagLedger([...byId.values()].sort(byIssuedAt));
}

function byIssuedAt(a: FlagIssued, b: FlagIssued) {
  return b.issuedAt - a.issuedAt || a.id.localeCompare(b.id);
}

export function trimFlagLedger(rows: FlagIssued[], max = FLAG_LEDGER_MAX): FlagIssued[] {
  if (rows.length <= max) return rows;
  const open = rows.filter((row) => !row.outcome).sort(byIssuedAt);
  const closed = rows.filter((row) => row.outcome).sort(byIssuedAt);
  const keepOpen = open.slice(0, max);
  const remaining = max - keepOpen.length;
  const keep = remaining > 0 ? [...keepOpen, ...closed.slice(0, remaining)] : keepOpen;
  return keep.sort(byIssuedAt);
}

export function flagsForWallet(ledger: FlagIssued[] | undefined, wallet: string) {
  if (!wallet || !ledger?.length) return [];
  return ledger.filter((row) => row.wallet === wallet);
}

export function flagsForMint(ledger: FlagIssued[] | undefined, mint: string) {
  if (!mint || !ledger?.length) return [];
  return ledger.filter((row) => row.mint === mint);
}

export function flagStats(ledger: FlagIssued[] | undefined, now = Date.now()) {
  let open = 0;
  let due = 0;
  let resolved = 0;
  for (const row of ledger || []) {
    if (row.outcome) {
      resolved += 1;
      continue;
    }
    open += 1;
    if (now >= row.resolutionDueAt) due += 1;
  }
  return { issued: (ledger || []).length, open, due, resolved };
}

export function publicFlag(row: FlagIssued) {
  return {
    id: row.id,
    wallet: row.wallet,
    mint: row.mint,
    name: row.name,
    ticker: row.ticker || null,
    slug: row.slug || null,
    flagType: row.flagType,
    threshold: row.threshold,
    launchCount: row.launchCount,
    issuedAt: row.issuedAt,
    resolutionDueAt: row.resolutionDueAt,
    outcome: row.outcome,
    outcomeResolvedAt: row.outcomeResolvedAt,
  };
}

function isFlagType(value: unknown): value is IssuedFlagType {
  return ISSUED_FLAG_TYPES.includes(value as IssuedFlagType);
}

function isOutcome(value: unknown): value is FlagOutcome {
  return FLAG_OUTCOMES.includes(value as FlagOutcome);
}

export function parseFlagIssued(raw: unknown): FlagIssued | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const wallet = typeof row.wallet === "string" ? row.wallet : "";
  const mint = typeof row.mint === "string" ? row.mint : "";
  const name = typeof row.name === "string" ? row.name : "";
  const issuedAt = Number(row.issuedAt);
  if (!id || !wallet || !mint || !name || !Number.isFinite(issuedAt)) return null;
  const flagType = isFlagType(row.flagType) ? row.flagType : "serial";
  const threshold = Number(row.threshold);
  const launchCount = Number(row.launchCount);
  const resolutionDueAt = Number(row.resolutionDueAt);
  return {
    id,
    wallet,
    mint,
    name,
    ticker: typeof row.ticker === "string" ? row.ticker : undefined,
    slug: typeof row.slug === "string" ? row.slug : undefined,
    flagType,
    threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 5,
    launchCount: Number.isFinite(launchCount) && launchCount > 0 ? launchCount : 5,
    issuedAt,
    resolutionDueAt: Number.isFinite(resolutionDueAt) ? resolutionDueAt : issuedAt + FLAG_RESOLVE_MS,
    outcome: isOutcome(row.outcome) ? row.outcome : null,
    outcomeResolvedAt: typeof row.outcomeResolvedAt === "number" ? row.outcomeResolvedAt : null,
  };
}

export function parseFlagLedger(raw: unknown): FlagIssued[] {
  if (!Array.isArray(raw)) return [];
  const out: FlagIssued[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const parsed = parseFlagIssued(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    out.push(parsed);
  }
  return trimFlagLedger(out.sort(byIssuedAt));
}
