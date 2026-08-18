export type WindowTx = {
  slot: number;
  feePayer: string | null;
  pumpIxs: number;
};

export function bundleFromWindow(createSlot: number, txs: WindowTx[]) {
  const same = txs.filter((t) => t.slot === createSlot);
  const buyers = new Set(
    same.filter((t) => t.pumpIxs > 0).map((t) => t.feePayer).filter((w): w is string => Boolean(w)),
  );
  const sameBlockBuys = same.reduce((sum, t) => sum + t.pumpIxs, 0);
  const createHasExtraBuy = same.some((t) => t.pumpIxs >= 2);
  return {
    sameBlockBuys,
    sameBlockWallets: buyers.size,
    sniper: buyers.size >= 3 || createHasExtraBuy,
  };
}
