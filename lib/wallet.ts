import { cache } from "react";
import { buildBoard } from "@/lib/board";
import { readStore } from "@/lib/store";
import type { BurnCache, TapeEvent } from "@/lib/types";
import { findWallet, type WalletRow } from "@/lib/wallets";

export type WalletPayload = {
  row: WalletRow;
  burn: BurnCache | null;
  tape: TapeEvent[];
};

export const loadWallet = cache(async (wallet: string): Promise<WalletPayload | null> => {
  const [board, store] = await Promise.all([buildBoard(), readStore()]);
  const row = findWallet(board.projects, wallet);
  if (!row) return null;
  const mints = new Set(row.coins.map((c) => c.mint));
  return {
    row,
    burn: store.burns[wallet] || null,
    tape: (store.tape || []).filter((e) => mints.has(e.mint)),
  };
});
