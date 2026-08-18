import { LiveEmbed } from "@/components/live-embed";
import { loadCoin } from "@/lib/coin";
import { parseEmbedVariant } from "@/lib/embed";
import { isValidAddress } from "@/lib/guardrails";
import type { Metadata } from "next";

export const revalidate = 20;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ mint: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ mint }, query] = await Promise.all([params, searchParams]);
  const variant = parseEmbedVariant(query.v);
  if (!isValidAddress(mint)) {
    return <p className="bg-bg p-4 font-mono text-sm text-muted">Invalid mint.</p>;
  }
  const payload = await loadCoin(mint);
  if (!payload) {
    return <p className="bg-bg p-4 font-mono text-sm text-muted">Not on the board.</p>;
  }
  const inner = (
    <LiveEmbed mint={mint} variant={variant} project={payload.project} dossier={payload.dossier} />
  );
  return (
    <div className="bg-bg text-ink">
      <a href={`/c/${mint}`} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    </div>
  );
}
