"use client";

import { useEffect, useState } from "react";
import { CoinShareCard } from "@/components/coin-share-card";
import { EmbedBadge } from "@/components/embed-badge";
import { POLL_MS } from "@/components/use-board-poll";
import type { EmbedVariant } from "@/lib/embed";
import type { Dossier, Project } from "@/lib/types";

type PublicCoin = {
  score?: number;
  officialRank?: number | null;
  officialDelta?: number | null;
  burned?: number | null;
  listedBurned?: number | null;
  walletBurned?: number | null;
  boostPoints?: number;
  flags?: Project["flags"];
  marketCap?: number | null;
  airdropMcap?: number | null;
};

export function LiveEmbed({
  mint,
  variant,
  project,
  dossier,
}: {
  mint: string;
  variant: EmbedVariant;
  project: Project;
  dossier: Dossier | null;
}) {
  const [p, setP] = useState(project);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/public/coin/${mint}`);
        if (!res.ok) return;
        const json = (await res.json()) as { coin?: PublicCoin };
        const c = json.coin;
        if (!alive || !c) return;
        setP((prev) => ({
          ...prev,
          score: c.score ?? prev.score,
          officialRank: c.officialRank ?? prev.officialRank,
          officialDelta: c.officialDelta ?? prev.officialDelta,
          verifiedBurn: c.walletBurned ?? prev.verifiedBurn,
          listedBurn: c.listedBurned ?? prev.listedBurn,
          boostPoints: c.boostPoints ?? prev.boostPoints,
          flags: c.flags?.length ? c.flags : prev.flags,
          live: prev.live
            ? {
                ...prev.live,
                marketCap: c.marketCap ?? prev.live.marketCap,
                airdropMcap: c.airdropMcap ?? prev.live.airdropMcap,
              }
            : prev.live,
        }));
      } catch {
        /* keep last */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    void tick();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [mint]);

  if (variant === "card") {
    return <CoinShareCard project={p} dossier={dossier} />;
  }
  return <EmbedBadge project={p} variant={variant} />;
}
