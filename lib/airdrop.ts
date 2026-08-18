export type HoldingStatus = "in_wallet" | "claimable" | "sold";

export type AirdropCoin = {
  mint: string;
  name: string;
  ticker?: string | null;
  slug?: string | null;
  priceUsd: number | null;
  imageUrl?: string | null;
  airdropTotal?: number | null;
};

export type HoldingRow = {
  mint: string;
  name: string;
  ticker?: string;
  slug?: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  imageUrl?: string | null;
  status: HoldingStatus;
};

function rowFromCoin(coin: AirdropCoin, amount: number, status: HoldingStatus): HoldingRow {
  const valueUsd = status === "in_wallet" && coin.priceUsd != null ? amount * coin.priceUsd : null;
  return {
    mint: coin.mint,
    name: coin.name,
    ticker: coin.ticker || undefined,
    slug: coin.slug || undefined,
    amount,
    priceUsd: coin.priceUsd,
    valueUsd,
    imageUrl: coin.imageUrl || undefined,
    status,
  };
}

export function matchHoldings(accounts: { mint: string; amount: number }[], coins: AirdropCoin[]): HoldingRow[] {
  const byMint = new Map(coins.map((c) => [c.mint, c]));
  const rows: HoldingRow[] = [];
  for (const acc of accounts) {
    if (!(acc.amount > 0)) continue;
    const coin = byMint.get(acc.mint);
    if (!coin) continue;
    rows.push(rowFromCoin(coin, acc.amount, "in_wallet"));
  }
  return rows.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0) || b.amount - a.amount);
}

export function holdingsTotal(rows: HoldingRow[]) {
  return rows.reduce((sum, r) => sum + (r.valueUsd || 0), 0);
}

export function airdropLedger(
  accounts: { mint: string; amount: number }[],
  coins: AirdropCoin[],
  ansemMint: string,
) {
  const held = new Map(accounts.map((a) => [a.mint, a.amount]));
  const holdsAnsem = (held.get(ansemMint) || 0) > 0;
  const claimed = matchHoldings(
    accounts.filter((a) => a.mint !== ansemMint),
    coins,
  );
  const claimedMints = new Set(claimed.map((r) => r.mint));
  const airdropped = coins.filter((c) => c.mint !== ansemMint && (c.airdropTotal || 0) > 0);
  const claimable: HoldingRow[] = [];
  const sold: HoldingRow[] = [];
  if (holdsAnsem) {
    for (const coin of airdropped) {
      if (claimedMints.has(coin.mint)) continue;
      if (held.has(coin.mint)) sold.push(rowFromCoin(coin, 0, "sold"));
      else claimable.push(rowFromCoin(coin, 0, "claimable"));
    }
    claimable.sort((a, b) => a.name.localeCompare(b.name));
    sold.sort((a, b) => a.name.localeCompare(b.name));
  }
  return {
    claimed,
    claimable,
    sold,
    missing: [...claimable, ...sold],
    holdsAnsem,
    ansemAmount: held.get(ansemMint) || 0,
    totalUsd: holdingsTotal(claimed),
  };
}
