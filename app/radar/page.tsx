import type { Metadata } from "next";
import Link from "next/link";
import { PageBack } from "@/components/page-back";
import { RadarList } from "@/components/radar-list";
import { SiteHeader } from "@/components/site-header";
import { buildBoard } from "@/lib/board";
import { ANSEM_Z500 } from "@/lib/links";
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
        <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <PageBack href="/" />
          <span>Gold / Diamond · independent</span>
        </p>
        <h1 className="display display-title mt-3 text-balance text-ink">Paid-tier radar</h1>
        <p className="mt-4 max-w-[40rem] text-pretty text-sm text-muted">
          Only listings that can stain z500 this week: Gold or Diamond with a burn short of the documented floor, a
          listed wallet that is not the mint-create wallet, a serial deployer, or a create-slot bundle. Clean paid
          tiers stay off this page. Launch, claim, boost, and burn stay on{" "}
          <a href={ANSEM_Z500} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-gold-lit">
            ansem.io
          </a>
          .{" "}
          <Link href="/guide" className="text-ink hover:text-gold-lit">
            How to read this site
          </Link>
          .
        </p>
        <RadarList initial={rows} stats={stats} />
      </main>
    </div>
  );
}
