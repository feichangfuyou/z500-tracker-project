import Image from "next/image";
import Link from "next/link";
import { IndexBasket } from "@/components/index-basket";
import { PageBack } from "@/components/page-back";
import { SiteHeader } from "@/components/site-header";
import { ScrambleText } from "@/components/scramble-text";
import { buildBoard } from "@/lib/board";
import { indexFromProjects, overlayLiveIndex } from "@/lib/index-day";
import { readStore } from "@/lib/store";

export const revalidate = 20;

export default async function IndexPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const [store, board] = await Promise.all([readStore(), buildBoard().catch(() => null)]);
  const liveDay = board ? indexFromProjects(board.projects) : null;
  const days = store.indexDays?.length ? store.indexDays : liveDay ? [liveDay] : [];
  const selectedAt = d ? Number(d) : days[0]?.at;
  const snapshot = days.find((day) => day.at === selectedAt) || days[0] || liveDay;
  const latest = snapshot ? overlayLiveIndex(snapshot, liveDay) : null;

  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <section className="hero-banner hero-banner--open overflow-hidden border border-border">
          <div className="hero-banner__art" aria-hidden>
            <Image
              src="/brand/tracker-banner.png"
              alt=""
              fill
              priority
              quality={70}
              sizes="(max-width: 900px) 100vw, 1400px"
              className="hero-banner__still"
            />
          </div>
          <div className="hero-banner__copy max-w-[620px] px-5 py-4 lg:px-7 lg:py-5">
            <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <PageBack href="/" />
              <span>Crosscheck basket · unofficial</span>
            </p>
            <h1 className="display display-title mt-2 text-balance text-ink">Daily index</h1>
            <p className="mt-2 max-w-[36rem] text-pretty text-sm text-muted">
              Each UTC day we snapshot the top 25 coins by Crosscheck score. That snapshot is the backbone for “moved X
              spots today” on the board and in closed-tab alerts. This is our basket, not ansem.io’s z500.{" "}
              <Link href="/guide#score" className="text-ink hover:text-gold-lit">
                <ScrambleText text="How the score is calculated" />
              </Link>
              .
            </p>
          </div>
        </section>
        {!latest || !snapshot ? (
          <div className="mt-8">
            <p className="text-sm text-muted">No snapshot yet — wait for the next scan.</p>
            <Link href="/" className="type-btn mt-4 inline-flex h-8 items-center border border-accent bg-accent px-4 font-semibold text-void">
              <ScrambleText text="Open the board" />
            </Link>
          </div>
        ) : (
          <IndexBasket snapshot={snapshot} liveDay={liveDay} days={days} />
        )}
      </main>
    </div>
  );
}
