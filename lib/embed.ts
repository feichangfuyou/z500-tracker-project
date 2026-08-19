import { fmtCompact } from "./format";
import { publicBurn } from "./score";
import type { Flag, Project } from "./types";

export const EMBED_VARIANTS = ["card", "chip", "burn", "flags", "delta"] as const;
export type EmbedVariant = (typeof EMBED_VARIANTS)[number];

export const EMBED_CREDIT = "Powered by Crosscheck · launched on ansem.io";

export const EMBED_SIZES: Record<EmbedVariant, { width: number; height: number; label: string }> = {
  chip: { width: 200, height: 40, label: "Tiny chip" },
  burn: { width: 360, height: 88, label: "Verified burn" },
  flags: { width: 360, height: 88, label: "Flags" },
  delta: { width: 360, height: 88, label: "Listed vs Crosscheck" },
  card: { width: 360, height: 240, label: "Dossier card" },
};

export type EmbedCoin = Pick<
  Project,
  "mint" | "name" | "ticker" | "verifiedBurn" | "listedBurn" | "officialRank" | "officialDelta" | "flags" | "slug" | "score"
>;

export function parseEmbedVariant(raw: string | null | undefined): EmbedVariant {
  const v = (raw || "card").toLowerCase();
  return (EMBED_VARIANTS as readonly string[]).includes(v) ? (v as EmbedVariant) : "card";
}

export function embedPath(mint: string, variant: EmbedVariant = "card") {
  return variant === "card" ? `/embed/${mint}` : `/embed/${mint}?v=${variant}`;
}

export function iframeSnippet(origin: string, mint: string, variant: EmbedVariant, title: string) {
  const { width, height } = EMBED_SIZES[variant];
  const src = `${origin.replace(/\/$/, "")}${embedPath(mint, variant)}`;
  const safeTitle = title.replace(/[<>"]/g, "").slice(0, 80) || "Coin";
  return `<iframe src="${src}" width="${width}" height="${height}" style="border:0" loading="lazy" title="${safeTitle} Crosscheck"></iframe>`;
}

export function crosscheckRankFromDelta(p: Pick<EmbedCoin, "officialRank" | "officialDelta">) {
  if (p.officialRank == null || p.officialDelta == null) return null;
  return p.officialRank - p.officialDelta;
}

export function burnLine(p: Pick<EmbedCoin, "verifiedBurn" | "listedBurn">) {
  if (p.listedBurn == null && p.verifiedBurn == null) return "Burns not verified";
  const amount = `${fmtCompact(publicBurn({ ...p, burnAmount: 0 }))} $ANSEM`;
  return p.listedBurn != null ? `${amount} credited` : `${amount} burned`;
}

export function deltaLine(p: Pick<EmbedCoin, "officialRank" | "officialDelta">) {
  const ours = crosscheckRankFromDelta(p);
  const official = p.officialRank != null ? `#${p.officialRank}` : "—";
  const crosscheck = ours != null ? `#${ours}` : "—";
  return `Listed ${official} · Crosscheck ${crosscheck}`;
}

export function flagLine(flags: Flag[]) {
  if (!flags.length) return "No flags";
  return flags
    .slice(0, 2)
    .map((f) => f.label)
    .join(" · ");
}

export function chipLine(p: EmbedCoin) {
  if (p.listedBurn != null || p.verifiedBurn != null) return burnLine(p);
  if (p.officialRank != null) return deltaLine(p);
  if (p.flags.length) return flagLine(p.flags);
  return p.ticker ? `$${p.ticker}` : p.name;
}
