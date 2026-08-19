"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum } from "@/components/live-num";
import { cn } from "@/lib/cn";
import { EMBED_CREDIT, crosscheckRankFromDelta, flagLine, type EmbedCoin, type EmbedVariant } from "@/lib/embed";
import { publicBurn } from "@/lib/score";

export function EmbedBadge({ project, variant }: { project: EmbedCoin; variant: Exclude<EmbedVariant, "card"> }) {
  const burned = publicBurn({ ...project, burnAmount: 0 });
  const hasBurn = project.listedBurn != null || project.verifiedBurn != null;
  if (variant === "chip") {
    return (
      <BadgeFrame className="h-10 w-[200px] max-w-full gap-2 px-2">
        <BrandMark className="size-5 shrink-0" />
        <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-ink">
          {hasBurn ? (
            <>
              <LiveNum value={burned} format="compact" /> $ANSEM
            </>
          ) : project.officialRank != null ? (
            <>
              listed <LiveNum value={project.officialRank} format="rank" flash={false} />
            </>
          ) : project.flags.length ? (
            flagLine(project.flags)
          ) : (
            project.ticker ? `$${project.ticker}` : project.name
          )}
        </span>
      </BadgeFrame>
    );
  }

  if (variant === "burn") {
    return (
      <BadgeFrame className="h-[88px] w-full max-w-[360px] gap-3 px-3">
        <BrandMark className="size-6 shrink-0" />
        <span className="min-w-0">
          <span className="type-eyebrow block">{project.listedBurn != null ? "Listed burn" : "Wallet burn"}</span>
          <span className="mt-1 block truncate font-mono text-sm tabular-nums text-ink">
            {hasBurn ? (
              <>
                <LiveNum value={burned} format="compact" reel />{" "}
                {project.listedBurn != null ? "$ANSEM credited" : "$ANSEM burned"}
              </>
            ) : (
              "Burns not verified"
            )}
          </span>
          <span className="mt-1 block truncate font-mono text-[9px] text-dim">{EMBED_CREDIT}</span>
        </span>
      </BadgeFrame>
    );
  }

  if (variant === "flags") {
    return (
      <BadgeFrame className="h-[88px] w-full max-w-[360px] gap-3 px-3">
        <BrandMark className="size-6 shrink-0" />
        <span className="min-w-0">
          <span className="type-eyebrow block">Flags</span>
          <span className="mt-1 block">
            {project.flags.length ? (
              <FlagChips flags={project.flags} compact />
            ) : (
              <span className="font-mono text-sm text-muted">No flags</span>
            )}
          </span>
          <span className="mt-1 block truncate font-mono text-[9px] text-dim">{EMBED_CREDIT}</span>
        </span>
      </BadgeFrame>
    );
  }

  const ours = crosscheckRankFromDelta(project);
  return (
    <BadgeFrame className="h-[88px] w-full max-w-[360px] gap-3 px-3">
      <BrandMark className="size-6 shrink-0" />
      <span className="min-w-0">
        <span className="type-eyebrow block">Listed vs Crosscheck</span>
        <span className="mt-1 block truncate font-mono text-sm tabular-nums text-ink">
          Listed <LiveNum value={project.officialRank} format="rank" reel />
          {" · Crosscheck "}
          <LiveNum value={ours} format="rank" reel />
        </span>
        <span className="mt-1 block truncate font-mono text-[9px] text-dim">{EMBED_CREDIT}</span>
      </span>
    </BadgeFrame>
  );
}

function BadgeFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex max-w-full items-center border border-border bg-panel", className)}>
      {children}
    </span>
  );
}
