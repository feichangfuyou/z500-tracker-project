import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PageBack } from "@/components/page-back";
import { FadeIn } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { ScrambleText } from "@/components/scramble-text";
import { ANSEM_AIRDROP, ANSEM_ORIGIN, ANSEM_Z500 } from "@/lib/links";

export const metadata: Metadata = {
  title: "Guide — Crosscheck",
  description:
    "What ansem.io is, what Crosscheck tracks, and how to read the board, flags, and coin pages. Unofficial companion — not built by ansem.io.",
};

const STEPS = [
  [
    "ansem.io launches the coins",
    "People create new tokens on ansem.io. Teams can burn $ANSEM and buy boosts to climb the official z500 list. Claiming airdrops and trading the launch itself still happen there.",
  ],
  [
    "Crosscheck watches the same list",
    "This site pulls those launches and adds checks ansem.io does not show in one place: on-chain burns, listed wallet vs mint-create wallet, holder concentration, and warning flags.",
  ],
  [
    "Read the board, then open a coin",
    "The homepage table is the live list. Click a name for the scorecard — Pass, Warn, Fail, or not checked yet — plus creator check, holders, burns, and why a flag appeared.",
  ],
] as const;

const ANSEM_TERMS = [
  ["ansem.io", "A Solana launch site. Coins go live there. Crosscheck is not that site."],
  ["$ANSEM", "ansem.io’s token. Launch teams burn it. Holders can receive airdrops from new coins."],
  ["Burn", "Sending $ANSEM to a dead address so it cannot be spent again. Used to list or rank a coin."],
  ["Boost", "Paid extra visibility on ansem.io. Active boosts also feed our score."],
  ["z500", "ansem.io’s official ranking. We show a Listed # estimate from public inputs. Score is ours."],
  ["Tier", "Free, Bronze, Gold, or Diamond on ansem.io. Higher tiers usually mean more $ANSEM burned."],
  ["Airdrop", "New-coin tokens sent to $ANSEM holders. “Airdrop” on this board is that supply’s dollar value."],
] as const;

const BOARD_COLS = [
  ["#", "Place on this board right now, by the sort you picked (usually our score)."],
  ["Flags", "Checks that fired. Empty is better. See the flag list below."],
  ["Tier", "ansem.io listing tier."],
  ["Mcap", "Circulating market cap from DexScreener, with the listed figure as fallback."],
  ["Airdrop", "Dollar value of tokens airdropped to $ANSEM holders."],
  ["Burned", "How much $ANSEM we verified on-chain from the launch wallet."],
  ["Score", "Our ranking: airdrop value + verified burns + active boosts. Invented here — not z500’s formula."],
  ["Listed", "Where the coin sits if we rank public ansem.io inputs only (airdrop value + boosts, no on-chain burns)."],
] as const;

const FLAGS = [
  ["Listed ≠ create", "Listed launch wallet is not the mint-create wallet we found. A warning, not a fail — they may be different jobs."],
  ["Bundle / sniper", "Buys in the same create block, or RugCheck labeled it a sniper/bundle."],
  ["5 / 8 launches", "Same wallet launched several coins on this board. Five is a warning, eight is worse."],
  ["Insiders", "Wallets RugCheck calls insiders hold a large share."],
  ["Top 10", "The ten largest holders own most of the supply."],
  ["Thin liquidity", "The coin already migrated, but the pool is very small."],
  ["Burn below claim", "On-chain $ANSEM burns are far under what was claimed."],
  ["Burns unchecked", "Gold or Diamond with no scan yet, or a scan that found no burns."],
  ["Early concentration", "The coin is minutes old and already tightly held."],
] as const;

const PAGES = [
  ["Board", "/", "Live list of launches. Start here after the primer."],
  ["Radar", "/radar", "Gold and Diamond with a burn gap, listed ≠ create, serial, or bundle."],
  ["Index", "/index", "Each UTC day we snapshot the top 25 by our score."],
  ["Wallets", "/wallets", "Launch wallets grouped together. Serial means five or more coins."],
  ["Airdrop", "/airdrop", "Paste a wallet to see claimed vs still-claimable vs sold. Claiming is on ansem.io."],
  ["Embed", "/partner", "Badges and public JSON if you want Crosscheck on another page."],
] as const;

function Entry({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="font-mono text-[12px] text-ink">{k}</dt>
      <dd className="text-pretty text-sm text-muted">{v}</dd>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[1400px] py-6 sm:py-8">
        <section className="hero-banner hero-banner--open hero-banner--guide overflow-hidden border border-border">
          <div className="hero-banner__art" aria-hidden>
            <Image
              src="/brand/guide-hero.png"
              alt=""
              fill
              priority
              quality={90}
              sizes="(max-width: 1400px) 100vw, 1400px"
              className="hero-banner__still"
            />
          </div>
          <div className="hero-banner__copy max-w-[620px] px-5 py-5 lg:px-8 lg:py-7">
            <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <PageBack href="/" />
              <span>Start here · unofficial</span>
            </p>
            <h1 className="display display-title mt-3 text-balance text-ink">How to read this site</h1>
            <p className="mt-4 max-w-[36rem] text-pretty text-sm text-muted">
              Crosscheck is an unofficial tracker for coins launching on{" "}
              <a href={ANSEM_ORIGIN} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-gold-lit">
                <ScrambleText text="ansem.io" />
              </a>
              . If you have never used ansem.io, the board will look like noise. This page is the map.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/#board"
                className="type-btn inline-flex h-8 items-center border border-accent bg-accent px-3 font-semibold text-void hover:border-accent-hover hover:bg-accent-hover"
              >
                <ScrambleText text="Open the board" />
              </Link>
              <a
                href={ANSEM_Z500}
                target="_blank"
                rel="noopener noreferrer"
                className="type-btn inline-flex h-8 items-center border border-border px-3 text-muted hover:text-ink"
              >
                <ScrambleText text="Official z500" />
              </a>
            </div>
          </div>
        </section>

        <FadeIn>
        <div className="w-full max-w-[800px]">
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="display text-lg text-ink">Three things to know</h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map(([title, body], i) => (
              <li key={title}>
                <p className="type-eyebrow">{i + 1}. {title}</p>
                <p className="mt-2 text-pretty text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="ansem" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">What ansem.io is</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            A launch pad on Solana. New coins list there. The official leaderboard is z500. Crosscheck did not build
            that, and we are not endorsed by them. Launch, claim, boost, and burn still happen on ansem.io.
          </p>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            {ANSEM_TERMS.map(([k, v]) => (
              <Entry key={k} k={k} v={v} />
            ))}
          </dl>
          <p className="mt-4">
            <a
              href={ANSEM_AIRDROP}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-muted hover:text-ink"
            >
              <ScrambleText text="Claim airdrops on ansem.io" />
            </a>
          </p>
        </section>

        <section id="crosscheck" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">What we built</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            An independent ledger of the same launches. We fetch the public ansem.io list, then overlay DexScreener
            prices and Solana checks. You use this to see whether a launch’s story matches the chain.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-pretty text-sm text-muted">
            <li>A scorecard on each coin: wallet, burns, holders, insiders, snipers, serial launches, liquidity.</li>
            <li>Live board with market cap, airdrop value, burns, boosts, and two ranks (ours vs listed-order).</li>
            <li>On-chain $ANSEM burn scans from the launch wallet.</li>
            <li>Creator check: listed launch wallet vs the mint-create wallet we found.</li>
            <li>Holder concentration, same-slot buyers, and serial-deployer counts.</li>
            <li>Daily top-25 snapshot, known wallets, airdrop P&amp;L lookup, and embeddable badges.</li>
            <li>Paid-tier radar: Gold/Diamond with a burn gap, listed ≠ create, serial, or bundle.</li>
          </ul>
        </section>

        <section id="board" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">The board</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            Filters along the top (On curve, Migrated, Boosted, Flagged) narrow the list. Live keeps prices moving.
            Listed is the default sort (public ansem.io inputs). Mcap / Score are overlays. Watch stars a coin in this
            browser.
          </p>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            {BOARD_COLS.map(([k, v]) => (
              <Entry key={k} k={k} v={v} />
            ))}
          </dl>
        </section>

        <section id="scorecard" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">The scorecard</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            Each coin page grades seven checks. This is a checklist, not a buy rating. Overall is Flagged if anything
            failed, Caution if anything warned, Clear if at least three checks passed and nothing is off, Incomplete
            if we have not seen enough yet. The number next to the grade is a risk score from the flags.
          </p>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            <Entry k="Wallet" v="Listed vs mint-create wallet. Same wallet is a pass. Different wallet is a warning — we compared addresses, not intent." />
            <Entry k="Burns" v="Did we verify $ANSEM burns on-chain? Gold/Diamond with none is a warning. A claimed burn the chain does not back is a fail." />
            <Entry k="Holders" v="Share owned by the top 10 wallets. Warn at 55%, fail at 75%." />
            <Entry k="Insiders" v="Share RugCheck labels as insiders. Warn at 12%, fail at 25%." />
            <Entry k="Snipers" v="Same-block buyers at create, or a RugCheck sniper/bundle label." />
            <Entry k="Serial" v="How many coins this launch wallet has on the board. Warn at 5, fail at 8." />
            <Entry k="Liquidity" v="Pool size after the coin migrates. Warn under $3k, fail under $1k. On-curve coins stay unchecked." />
          </dl>
        </section>

        <section id="flags" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">Flags and the coin page</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            Rose outline is bad. Gold outline is a warning. A number next to the chips is a risk score. On the coin page,
            On-chain is a labeled grid: listed wallet, creator check, create wallet, pump.fun creator, top holders,
            launch count, same-slot buyers, and last burn scan.
          </p>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            {FLAGS.map(([k, v]) => (
              <Entry key={k} k={k} v={v} />
            ))}
          </dl>
          <p className="mt-4 text-pretty text-sm text-muted">
            Creator check is same wallet, different wallet, or not checked. Same wallet means the listed address
            matches a creator we found. Different wallet means we found a creator and it is not that address.
            Not checked means we have not seen enough yet.
          </p>
        </section>

        <section id="pages" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">Other pages</h2>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            {PAGES.map(([k, href, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt>
                  <Link href={href} className="font-mono text-[12px] text-ink hover:text-gold-lit">
                    <ScrambleText text={k} />
                  </Link>
                </dt>
                <dd className="text-pretty text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-10 text-pretty text-[12.5px] text-dim">
          Not financial advice. Data can be late or wrong. Burns cover the scanned window, not all of Solana history.
          Crosscheck is not built or endorsed by ansem.io.
        </p>
        </div>
        </FadeIn>
      </main>
    </div>
  );
}
