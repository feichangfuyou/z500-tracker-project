import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PageBack } from "@/components/page-back";
import { FadeIn } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { ScrambleText } from "@/components/scramble-text";
import { ANSEM_AIRDROP, ANSEM_ORIGIN } from "@/lib/links";

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
    "This site pulls those launches and adds checks ansem.io does not show in one place: credited burns vs what we independently assigned (unverified when a stranger burn does not name a coin), listed wallet vs mint-create wallet, holder concentration, and a live flag feed when a wallet hits its fifth coin.",
  ],
  [
    "Read the board, then open a coin",
    "The homepage and /z500 are the live list — $ANSEM at #1, NSFW included. Click a name for the scorecard.",
  ],
] as const;

const ANSEM_TERMS = [
  ["ansem.io", "A Solana launch site. Coins go live there. Crosscheck is not that site."],
  ["$ANSEM", "ansem.io’s token. Launch teams burn it. Holders can receive airdrops from new coins."],
  ["Burn", "Sending $ANSEM to a dead address so it cannot be spent again. Used to list or rank a coin."],
  ["Boost", "Paid extra visibility on ansem.io. Active boosts also feed our score."],
  ["z500", "ansem.io’s index. Default sort is circulating mcap; $ANSEM is #1; NSFW stays on the list. Boosts are a badge. Burns unlock Gold/Diamond."],
  ["Tier", "Free, Bronze, Gold, or Diamond on ansem.io. Higher tiers usually mean more $ANSEM burned."],
  ["Airdrop", "Tokens sent to $ANSEM holders. The hero figure is that token count, with ATH dollar value, coin count, and wallets underneath — same as ansem.io."],
] as const;

const BOARD_COLS = [
  ["#", "Place on this board right now, by the sort you picked. Default is z500 mcap."],
  ["Coin", "Name and ticker. $ANSEM (The Black Bull) is #1."],
  ["NSFW", "Adult-tagged launches. They stay on this list, marked NSFW — z500 hides them unless you turn that on."],
  ["Tier", "ansem.io listing tier."],
  ["MC", "Circulating market cap from ansem.io — the same number z500 sorts on."],
  ["Age", "Time since launch, same compact figure z500 prints (47h 22m)."],
  ["Txns", "24h transaction count from ansem.io."],
  ["Volume", "24h volume from ansem.io."],
  ["24h", "24h price change from ansem.io."],
  ["Airdrop", "Tokens airdropped to $ANSEM holders, printed the same compact way z500 does."],
  ["Status", "Migrated or still on the bonding curve."],
  ["Boost", "Paid extra visibility on ansem.io."],
  ["Flags", "Checks that fired. Empty is better. See the flag list below."],
  ["Burned", "Always the $ANSEM z500 credits to this coin. That number is ansem.io. Coverage is our separate on-chain check."],
  ["Score", "Published Crosscheck v1: airdrop mcap × 0.6 + burn USD × 40 + boost points × 250. Each coin page shows the parts."],
] as const;

const FLAGS = [
  ["Bundle / sniper", "Buys in the same create block, or RugCheck labeled it a sniper/bundle."],
  ["5 / 8 launches", "Same wallet launched several coins on this board. Five is a warning, eight is worse. Those crossings are timestamped and kept after the live tape rolls."],
  ["Insiders", "Wallets RugCheck calls insiders hold a large share."],
  ["Top 10", "The ten largest holders own most of the supply."],
  ["Thin liquidity", "The coin already migrated, but the pool is very small."],
  ["Burn below claim", "On-chain $ANSEM burns are far under what was claimed."],
  ["Burns unchecked", "Gold or Diamond with no scan yet, or a scan that found no burns."],
  ["Unlabeled burners", "z500 credits $ANSEM from a burn we still cannot assign to this coin. The tx did not name it, and the amount was not a unique gap. We do not silently omit that."],
  ["Burn coverage %", "Share of credited $ANSEM we independently assigned to this coin. Below 75% is a warning. Board headline is the same figure vs ansem.io across all credited coins."],
  ["Early concentration", "The coin is minutes old and already tightly held."],
] as const;

const PAGES = [
  ["Board", "/", "Live list of launches. Start here after the primer. Rank arrows are vs yesterday’s index when we have one."],
  ["Radar", "/radar", "Gold and Diamond with a burn gap, serial launches, or a bundle."],
  ["Index", "/index", "Each UTC day we snapshot the top 25 by our score. That snapshot is how the board knows a coin moved X spots today."],
  ["Wallets", "/wallets", "Launch wallets grouped together. Serial means five or more coins — flagged live, timestamped, and kept after the tape rolls."],
  ["Airdrop", "/airdrop", "Optional lookup: paste a wallet to see claimed vs still-claimable vs sold. Claiming is on ansem.io."],
  ["Embed", "/partner", "Badges and public JSON if you want Crosscheck on another page, including /api/public/flags."],
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
              <Link
                href="/z500"
                className="type-btn inline-flex h-8 items-center border border-border px-3 text-muted hover:text-ink"
              >
                <ScrambleText text="Open Z500" />
              </Link>
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
            <li>Published score formula with a per-coin breakdown: airdrop, burns, boosts.</li>
            <li>Live board with market cap, airdrop value, burns, boosts, two ranks (ours vs listed-order), and a just-flagged feed.</li>
            <li>On-chain $ANSEM burns from every burn of the token we can index, not only listed launch wallets. We assign a stranger burn when the tx names a coin or only one credited amount is still missing. Ambiguous amounts stay unverified.</li>
            <li>Creator check: listed launch wallet vs the mint-create wallet we found.</li>
            <li>Holder concentration, same-slot buyers, and serial-deployer counts the moment a wallet hits 5 or 8 launches. Those crossings are timestamped and kept after the live tape rolls.</li>
            <li>Daily top-25 snapshot used as the backbone for “moved X spots today.”</li>
            <li>Watch stars arm closed-tab alerts for flags and rank moves.</li>
            <li>Paid-tier radar: Gold/Diamond with a burn gap, listed ≠ create, serial, or bundle.</li>
          </ul>
        </section>

        <section id="board" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">The board</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            Filters along the top (On curve, Migrated, Boosted, Flagged) narrow the list. Live keeps prices moving.
            Listed is the default sort (z500 mcap). Mcap / Score are overlays. Watch stars a coin so flags and rank
            moves can alert you when the tab is closed.
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
            <Entry k="Wallet" v="Listed vs mint-create wallet. ansem.io usually lists the burn wallet, not the pump deployer. Both same-wallet and burn-wallet ≠ deployer are a pass." />
            <Entry k="Burns" v="Did we independently assign the credited $ANSEM? Gold/Diamond with none is a warning. Burns we cannot tie to a coin stay unverified. A claimed burn the chain does not back is a fail." />
            <Entry k="Holders" v="Share owned by the top 10 wallets. Warn at 55%, fail at 75%." />
            <Entry k="Insiders" v="Share RugCheck labels as insiders. Warn at 12%, fail at 25%." />
            <Entry k="Snipers" v="Same-block buyers at create, or a RugCheck sniper/bundle label." />
            <Entry k="Serial" v="How many coins this launch wallet has on the board. Warn at 5, fail at 8. Crossings are timestamped and kept after the live tape rolls." />
            <Entry k="Liquidity" v="Pool size after the coin migrates. Warn under $3k, fail under $1k. On-curve coins stay unchecked." />
          </dl>
        </section>

        <section id="score" className="mt-10 scroll-mt-[calc(var(--header-h)+0.75rem)] border-t border-border pt-6">
          <h2 className="display text-lg text-ink">The score</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            Crosscheck v1 is published. It is not z500’s unpublished formula. Each coin page shows the three parts so
            you can see why a row ranked where it did.
          </p>
          <p className="mt-3 font-mono text-[12px] text-ink">
            score = airdrop_mcap × 0.6 + ($ANSEM_burned × $ANSEM_price × 40) + (boost_points × 250)
          </p>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            <Entry k="Airdrop" v="If the coin airdropped tokens to $ANSEM holders, we use that supply × price. If that figure is 0, we fall back to circulating market cap." />
            <Entry k="Burns" v="z500’s credited $ANSEM × live $ANSEM price × 40. The breakdown also shows how much of that we independently assigned to the coin." />
            <Entry k="Boosts" v="Active ansem.io boost points × 250. Expired boosts drop out." />
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
            Creator check is same wallet, burn wallet ≠ deployer, or not checked. ansem.io usually lists the burn
            wallet, not the pump deployer, so a different address is a note — not a flag.
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
          Burns cover the mint-wide $ANSEM burn index, launch-wallet scans, and live webhook hits we could assign to a
          coin. A stranger burn with no coin on the transaction stays unverified unless the amount uniquely matches a
          missing credited total. Serial flags close after 14 days when liquidity is known. Crosscheck is not built or
          endorsed by ansem.io.
        </p>
        </div>
        </FadeIn>
      </main>
    </div>
  );
}
