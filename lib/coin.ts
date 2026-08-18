import { cache } from "react";
import { bannerUrlFrom, enhancedAtFrom, fetchAnsemCoin } from "@/lib/ansem";
import { buildBoard } from "@/lib/board";
import { projectFlags } from "@/lib/flags";
import { readStore } from "@/lib/store";
import { seriesForMint } from "@/lib/tape";
import type { Dossier, Project, RankPoint, TapeEvent } from "@/lib/types";

export type CoinPayload = {
  project: Project;
  history: RankPoint[];
  tape: TapeEvent[];
  scores: { mint: string; score: number }[];
  ansemPrice: number | null;
  dossier: Dossier | null;
};

export const loadCoin = cache(async (mint: string): Promise<CoinPayload | null> => {
  const [board, store] = await Promise.all([buildBoard(), readStore()]);
  const found = board.projects.find((p) => p.mint === mint);
  if (!found) return null;
  const detail = found.source === "ansem" && found.slug ? await fetchAnsemCoin(found.slug) : null;
  const project: Project = {
    ...found,
    bannerUrl: bannerUrlFrom(detail) || found.bannerUrl || null,
    enhancedAt: enhancedAtFrom(detail) || found.enhancedAt || null,
  };
  const holders = store.holders[mint];
  const dossier = store.dossiers[mint] || null;
  const withHolders: Dossier | null = dossier
    ? { ...dossier, holders: dossier.holders.length ? dossier.holders : holders?.holders || [] }
    : holders?.holders?.length
      ? {
          at: holders.at,
          holders: holders.holders,
          creator: store.provenance[mint]?.creator ?? project.launchWallet,
          onchainCreator: null,
          pumpCreator: null,
          createSig: null,
          createSlot: null,
          sameBlockBuys: 0,
          sameBlockWallets: 0,
          sniper: Boolean(holders.sniper),
        }
      : null;
  if (withHolders?.sniper && !project.sniper) {
    project.sniper = true;
    project.flags = projectFlags(project);
  }
  return {
    project,
    history: seriesForMint(store.rankHistory || [], mint),
    tape: (store.tape || []).filter((e) => e.mint === mint),
    scores: board.projects.map((p) => ({ mint: p.mint, score: p.score })),
    ansemPrice: board.ansemPrice,
    dossier: withHolders,
  };
});
