import { FLAG_RESOLVE_MS, flagStats } from "./flag-ledger";
import { LIQ_THIN } from "./flags";
import type { FlagIssued, FlagOutcome } from "./types";

/** Liquidity below this after the due date is treated as a rug. Thin-but-alive stays open. */
export const LIQ_RUG = 200;

export type CoinOutcomeHint = {
  mint: string;
  onBoard: boolean;
  liquidity: number | null;
  status?: string | null;
};

export function serialOutcome(hint: CoinOutcomeHint | undefined): FlagOutcome | null {
  if (!hint) return null;
  const liq = hint.liquidity;
  if (liq != null && liq < LIQ_RUG) return "confirmed_rug";
  if (hint.onBoard && liq != null && liq >= LIQ_THIN) return "held";
  if (!hint.onBoard && liq != null && liq < LIQ_THIN) return "confirmed_rug";
  return null;
}

export function resolveDueFlags(
  ledger: FlagIssued[] | undefined,
  hints: Record<string, CoinOutcomeHint> | ((mint: string) => CoinOutcomeHint | undefined),
  now = Date.now(),
): FlagIssued[] {
  return (ledger || []).map((row) => {
    if (row.outcome || now < row.resolutionDueAt) return row;
    const hint = typeof hints === "function" ? hints(row.mint) : hints[row.mint];
    const outcome = serialOutcome(hint);
    if (!outcome) return row;
    return { ...row, outcome, outcomeResolvedAt: now };
  });
}

export function outcomeHints(
  coins: { mint: string; status?: string | null }[],
  dex: Record<string, { live?: { liquidity?: number | null } | null }>,
): Record<string, CoinOutcomeHint> {
  const hints: Record<string, CoinOutcomeHint> = {};
  for (const coin of coins) {
    hints[coin.mint] = {
      mint: coin.mint,
      onBoard: true,
      liquidity: dex[coin.mint]?.live?.liquidity ?? null,
      status: coin.status ?? null,
    };
  }
  for (const [mint, cache] of Object.entries(dex)) {
    if (hints[mint]) continue;
    const liq = cache?.live?.liquidity;
    if (liq == null) continue;
    hints[mint] = { mint, onBoard: false, liquidity: liq };
  }
  return hints;
}

export function flagCloseStats(ledger: FlagIssued[] | undefined, now = Date.now()) {
  const base = flagStats(ledger, now);
  let confirmedRug = 0;
  let held = 0;
  let burnedAsClaimed = 0;
  for (const row of ledger || []) {
    if (row.outcome === "confirmed_rug") confirmedRug += 1;
    else if (row.outcome === "held") held += 1;
    else if (row.outcome === "burned_as_claimed") burnedAsClaimed += 1;
  }
  const closed = confirmedRug + held + burnedAsClaimed;
  return {
    ...base,
    confirmedRug,
    held,
    burnedAsClaimed,
    rugRate: closed > 0 ? confirmedRug / closed : null,
    resolveAfterMs: FLAG_RESOLVE_MS,
  };
}
