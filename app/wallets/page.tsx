import Image from "next/image";
import Link from "next/link";
import { PageBack } from "@/components/page-back";
import { SiteHeader } from "@/components/site-header";
import { ScrambleText } from "@/components/scramble-text";
import { WalletList } from "@/components/wallet-list";
import { buildBoard } from "@/lib/board";
import { launchWallets } from "@/lib/wallets";

export const revalidate = 20;

export default async function WalletsPage() {
  const board = await buildBoard().catch(() => null);
  const rows = board ? launchWallets(board.projects) : [];
  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <section className="hero-banner hero-banner--open hero-banner--wallets overflow-hidden border border-border">
          <div className="hero-banner__art" aria-hidden>
            <Image
              src="/brand/wallets-hero.png"
              alt=""
              fill
              priority
              quality={90}
              sizes="(max-width: 1400px) 100vw, 1400px"
              className="hero-banner__still"
            />
          </div>
          <div className="hero-banner__copy max-w-[34rem] px-5 py-4 lg:px-7 lg:py-5">
            <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <PageBack href="/" />
              <span>Launch wallets on this board</span>
            </p>
            <h1 className="display display-title mt-3 text-balance text-ink">Known wallets</h1>
            <p className="mt-4 max-w-[36rem] text-pretty text-sm text-muted">
              Launch wallets on this board, Gold and Diamond first. Serial is five or more coins from the same wallet.
              Not a copy-trade product.{" "}
              <Link href="/guide" className="text-ink hover:text-gold-lit">
                <ScrambleText text="How to read this site" />
              </Link>
              .
            </p>
          </div>
        </section>
        <WalletList initial={rows} />
      </main>
    </div>
  );
}
