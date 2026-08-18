import { computeScore, effectiveBurn } from "./score";
import type { Project } from "./types";

type Scored = Pick<Project, "mint" | "live" | "verifiedBurn" | "burnAmount" | "burnPriceRef" | "boostPoints" | "score">;

export function scoreWithExtraBurn(p: Scored, extraBurn: number) {
  return computeScore({
    ...p,
    verifiedBurn: effectiveBurn(p) + Math.max(0, extraBurn),
  });
}

export function rankAfterScore(scores: { mint: string; score: number }[], mint: string, nextScore: number) {
  const better = scores.filter((s) => s.mint !== mint && s.score > nextScore).length;
  return better + 1;
}

export function simulateBurn(projects: Scored[], mint: string, extraBurn: number) {
  const target = projects.find((p) => p.mint === mint);
  if (!target) return null;
  const currentRank = rankAfterScore(
    projects.map((p) => ({ mint: p.mint, score: p.score })),
    mint,
    target.score,
  );
  const nextScore = scoreWithExtraBurn(target, extraBurn);
  const nextRank = rankAfterScore(
    projects.map((p) => ({ mint: p.mint, score: p.score })),
    mint,
    nextScore,
  );
  return {
    currentRank,
    nextRank,
    currentScore: target.score,
    nextScore,
    delta: currentRank - nextRank,
  };
}
