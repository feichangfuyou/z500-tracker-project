"use client";

import { BrandMark } from "@/components/brand-mark";
import { FlagChips } from "@/components/flag-chips";
import { LiveNum } from "@/components/live-num";
import { EMBED_CREDIT } from "@/lib/embed";
import { fmtCompact, fmtRank, fmtUsd, shortAddr } from "@/lib/format";
import { solscanTx } from "@/lib/links";
import { publicBurn } from "@/lib/score";
import type { Dossier, Project } from "@/lib/types";

export function CoinShareCard({ project, dossier }: { project: Project; dossier: Dossier | null }) {
  const p = project;
  return (
    <aside className="border border-border bg-panel p-4">
      <div className="flex items-center gap-2">
        <BrandMark />
        <p className="display text-[13px] leading-none text-ink">CROSSCHECK</p>
      </div>
      <p className="display mt-4 text-balance text-xl text-ink">{p.name}</p>
      <p className="mt-1 font-mono text-[11px] text-dim">
        {p.ticker ? `$${p.ticker}` : shortAddr(p.mint)} · {p.tier}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm tabular-nums">
        <div>
          <dt className="type-eyebrow">Listed</dt>
          <dd className="text-ink">
            <LiveNum value={p.officialRank} format={fmtRank} reel />
          </dd>
        </div>
        <div>
          <dt className="type-eyebrow">Score</dt>
          <dd className="text-ink">
            <LiveNum value={p.score} format={fmtCompact} reel />
          </dd>
        </div>
        <div>
          <dt className="type-eyebrow">Burned</dt>
          <dd className="text-ink">
            <LiveNum value={publicBurn(p)} format={fmtCompact} reel />
          </dd>
        </div>
        <div>
          <dt className="type-eyebrow">Airdrop</dt>
          <dd className="text-ink">
            <LiveNum value={p.live?.airdropMcap} format={fmtUsd} reel />
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <FlagChips flags={p.flags} compact />
      </div>
      {dossier?.createSig && (
        <p className="mt-3 font-mono text-[10px] text-dim">
          <a href={solscanTx(dossier.createSig)} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            Create {shortAddr(dossier.createSig)}
          </a>
          {dossier.createSlot ? (
            <>
              {" · slot "}
              <LiveNum value={dossier.createSlot} format="int" flash={false} />
            </>
          ) : null}
        </p>
      )}
      <p className="mt-3 font-mono text-[9px] text-dim">{EMBED_CREDIT}</p>
    </aside>
  );
}
