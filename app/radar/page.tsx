import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageBack } from "@/components/page-back";
import { RadarList } from "@/components/radar-list";
import { ScrambleText } from "@/components/scramble-text";
import { SiteHeader } from "@/components/site-header";
import { buildBoard } from "@/lib/board";
import { ANSEM_ORIGIN } from "@/lib/links";
import { paidRadar, radarStats } from "@/lib/paid-radar";

export const revalidate = 20;

export const metadata: Metadata = {
  title: "Paid-tier radar — Crosscheck",
  description:
    "Gold and Diamond listings with a burn gap, listed wallet ≠ create, serial deployer, or create-slot bundle. Independent check. Unofficial companion to ansem.io.",
};

export default async function RadarPage() {
  const board = await buildBoard().catch(() => null);
  const projects = board?.projects || [];
  const rows = paidRadar(projects);
  const stats = radarStats(projects, rows);
  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <section className="hero-banner hero-banner--radar overflow-hidden border border-border">
          <div className="hero-banner__art" aria-hidden>
            <Image
              src="/brand/radar-hero.png"
              alt=""
              fill
              priority
              quality={90}
              sizes="(max-width: 639px) 100vw, (max-width: 1400px) 55vw, 770px"
              className="hero-banner__still"
            />
          </div>
          <div className="hero-banner__copy max-w-[32rem] px-5 py-3 lg:px-7 lg:py-4">
            <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <PageBack href="/" />
              <span>Gold / Diamond · independent</span>
            </p>
            <h1 className="display display-title mt-2 text-balance text-ink">Paid-tier radar</h1>
            <p className="mt-2 text-pretty text-sm text-muted sm:hidden">
              Gold or Diamond with a burn gap, listed ≠ create, serial, or bundle — pulled off our Z500.{" "}
              <Link href="/z500" className="text-ink hover:text-gold-lit">
                <ScrambleText text="Open Z500" />
              </Link>
              .
            </p>
            <p className="mt-2 hidden max-w-[36rem] text-pretty text-sm text-muted sm:block">
              A filter on our Z500, not the index itself. Only Gold or Diamond that can stain the list this week: burn
              short of the documented floor, listed wallet ≠ mint-create wallet, serial deployer, or create-slot bundle.
              Clean paid tiers stay off this page. Launch, claim, boost, and burn stay on{" "}
              <a href={ANSEM_ORIGIN} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-gold-lit">
                <ScrambleText text="ansem.io" />
              </a>
              .
            </p>
            <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
              <Link
                href="/z500"
                className="type-btn inline-flex h-8 items-center border border-accent bg-accent px-3 font-semibold text-void hover:border-accent-hover hover:bg-accent-hover"
              >
                <ScrambleText text="Open Z500" />
              </Link>
              <Link
                href="/guide"
                className="type-btn inline-flex h-8 items-center border border-border px-3 text-muted hover:text-ink"
              >
                <ScrambleText text="How to read this" />
              </Link>
            </div>
          </div>
        </section>
        <RadarList initial={rows} stats={stats} />
      </main>
    </div>
  );
}
