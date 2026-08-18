"use client";

import { useCallback, useState } from "react";
import { CoinShareCard } from "@/components/coin-share-card";
import { CopySnippet } from "@/components/copy-snippet";
import { EmbedBadge } from "@/components/embed-badge";
import { useBoardPoll } from "@/components/use-board-poll";
import { EMBED_SIZES, EMBED_VARIANTS } from "@/lib/embed";
import type { BoardResponse, Project } from "@/lib/types";

export function PartnerPreviews({ sample }: { sample: Project }) {
  const [project, setProject] = useState(sample);
  const onBoard = useCallback(
    (board: BoardResponse) => {
      const row = board.projects.find((p) => p.mint === sample.mint);
      if (row) setProject(row);
    },
    [sample.mint],
  );
  useBoardPoll(onBoard);

  return (
    <ol className="mt-6 space-y-8">
      {EMBED_VARIANTS.map((variant) => {
        const size = EMBED_SIZES[variant];
        return (
          <li key={variant} id={variant}>
            <p className="type-eyebrow">
              {size.label} · {size.width}×{size.height}
            </p>
            <div className="mt-3 max-w-full overflow-x-auto">
              {variant === "card" ? (
                <CoinShareCard project={project} dossier={null} />
              ) : (
                <EmbedBadge project={project} variant={variant} />
              )}
            </div>
            <div className="mt-3">
              <CopySnippet mint={project.mint} variant={variant} title={project.name} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
