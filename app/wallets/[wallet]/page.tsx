import Link from "next/link";
import { PageBack } from "@/components/page-back";
import { SiteHeader } from "@/components/site-header";
import { ScrambleText } from "@/components/scramble-text";
import { WalletView } from "@/components/wallet-view";
import { shortAddr } from "@/lib/format";
import { isValidAddress } from "@/lib/guardrails";
import { loadWallet } from "@/lib/wallet";
import type { Metadata } from "next";

export const revalidate = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ wallet: string }>;
}): Promise<Metadata> {
  const { wallet } = await params;
  const payload = isValidAddress(wallet) ? await loadWallet(wallet) : null;
  const label = payload ? shortAddr(payload.row.wallet) : "Wallet";
  return {
    title: `${label} — Crosscheck`,
    description: `Unofficial Crosscheck dossier for launch wallet ${label} on ansem.io.`,
  };
}

function Missing({ message }: { message: string }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-10">
        <PageBack href="/wallets" />
        <p className="mt-4 text-sm text-muted">{message}</p>
        <Link href="/wallets" className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void">
          <ScrambleText text="Known wallets" />
        </Link>
      </main>
    </div>
  );
}

export default async function WalletPage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!isValidAddress(wallet)) {
    return <Missing message="That wallet looks invalid." />;
  }
  const payload = await loadWallet(wallet);
  if (!payload) {
    return <Missing message="That wallet is not on the board yet." />;
  }
  return <WalletView initial={payload} />;
}
