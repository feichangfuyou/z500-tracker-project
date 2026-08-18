import { CoinView } from "@/components/coin-view";
import { PageBack } from "@/components/page-back";
import { SiteHeader } from "@/components/site-header";
import { loadCoin } from "@/lib/coin";
import { isValidAddress } from "@/lib/guardrails";
import type { Metadata } from "next";

export const revalidate = 20;

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }): Promise<Metadata> {
  const { mint } = await params;
  const payload = isValidAddress(mint) ? await loadCoin(mint) : null;
  const name = payload?.project.name || "Coin";
  return {
    title: `${name} — Crosscheck`,
    description: `Unofficial Crosscheck dossier for ${name} on ansem.io.`,
    openGraph: { title: `${name} — Crosscheck`, description: `Unofficial dossier for ${name}.` },
  };
}

function Missing({ message }: { message: string }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-10">
        <PageBack href="/" />
        <p className="mt-4 text-sm text-muted">{message}</p>
      </main>
    </div>
  );
}

export default async function CoinPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isValidAddress(mint)) {
    return <Missing message="That mint looks invalid." />;
  }
  const payload = await loadCoin(mint);
  if (!payload) {
    return <Missing message="That coin is not on the board yet." />;
  }
  return <CoinView initial={payload} />;
}
