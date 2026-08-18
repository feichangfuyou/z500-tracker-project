type Stamp = { at: number };

export function nextEnrichMints(
  mints: string[],
  cache: Record<string, Stamp | undefined>,
  staleMs: number,
  limit: number,
  now = Date.now(),
) {
  return mints
    .map((mint, i) => {
      const hit = cache[mint];
      return { mint, i, unseen: !hit, stale: !hit || now - hit.at >= staleMs };
    })
    .filter((row) => row.stale)
    .sort((a, b) => Number(b.unseen) - Number(a.unseen) || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((row) => row.mint);
}

export function enrichBudget(kind: "holders" | "provenance") {
  const rpc = process.env.SOLANA_RPC?.trim() || "";
  const paid = Boolean(rpc) && !rpc.includes("api.mainnet-beta.solana.com");
  if (kind === "holders") return paid ? 24 : 6;
  return paid ? 16 : 4;
}
