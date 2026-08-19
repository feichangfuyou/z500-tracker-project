import { CopySnippet } from "@/components/copy-snippet";
import { PageBack } from "@/components/page-back";
import { PartnerPreviews } from "@/components/partner-previews";
import { SiteHeader } from "@/components/site-header";
import { buildBoard } from "@/lib/board";
import { EMBED_SIZES, EMBED_VARIANTS } from "@/lib/embed";
import { isValidAddress } from "@/lib/guardrails";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Embed Crosscheck — partner kit",
  description:
    "Drop-in badges and public JSON for ansem.io coin pages. Independent burn and flag check. Unofficial companion.",
};

const API_FIELDS = [
  ["burned", "$ANSEM z500 credits to the coin (project burners), not only the listed launch wallet"],
  ["listedBurned", "Same as burned, explicit name"],
  ["walletBurned", "Listed-launch-wallet on-chain scan only. Can differ from burned and from independentlyBurned."],
  ["independentlyBurned", "$ANSEM we assigned to this coin: launch wallet plus stranger burns we could label"],
  ["burnCoveragePct", "independentlyBurned ÷ burned. Unlabeled burns are not guessed."],
  ["walletScanComplete", "true when we finished that wallet’s history — not every burn in existence"],
  ["provenance", "API: matched / mismatch / unknown — listed burn wallet vs pump deployer"],
  ["flags", "Live coin flags: sniper, thin liq, concentration — not listed ≠ create"],
  ["issuedAt", "On /api/public/flags: when a wallet crossed 5 or 8 launches. Survives the live tape."],
  ["outcome", "On /api/public/flags: confirmed_rug or held after 14 days when liquidity is known; otherwise null"],
  ["rugRate", "On /api/public/flags: confirmed_rug ÷ closed serial flags. Omitted until a flag closes."],
  ["officialRank", "z500 default: circulating mcap rank, counting $ANSEM as #1"],
  ["listedRank", "Same number as officialRank, clearer name"],
  ["reasons", "On /api/public/radar: pending, partial, short, serial, sniper"],
  ["officialDelta", "Listed # minus Crosscheck #"],
  ["ansemUrl", "Official coin page on ansem.io, when a slug exists"],
];

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ mint?: string }> }) {
  const { mint: rawMint } = await searchParams;
  const board = await buildBoard().catch(() => null);
  const requested = rawMint && isValidAddress(rawMint) ? board?.projects.find((p) => p.mint === rawMint) : null;
  const sample =
    requested ||
    board?.projects.find((p) => p.slug && p.verifiedBurn != null) ||
    board?.projects[0] ||
    null;
  const mint = sample?.mint || "MINT";
  const title = sample?.name || "Coin";

  return (
    <div className="min-h-dvh bg-bg pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto w-full min-w-0 max-w-[800px] py-6 sm:py-8">
        <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <PageBack href="/" />
          <span>Partner kit · unofficial</span>
        </p>
        <h1 className="display display-title mt-3 text-balance text-ink">Embed Crosscheck</h1>
        <p className="mt-4 text-pretty text-sm text-muted">
          Drop a badge on an ansem.io coin page. Crosscheck verifies burns and flags independently. Launch, claim,
          boost, and burn stay on ansem.io. Not built or endorsed by ansem.io.
        </p>

        <section className="mt-10 border-t border-border pt-6">
          <h2 className="display text-lg text-ink">Badges</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            One iframe. No auth. Copy uses this site’s origin so ansem.io can paste it. Click-through goes to the
            Crosscheck dossier.
          </p>
          {sample ? (
            <PartnerPreviews sample={sample} />
          ) : (
            <ol className="mt-6 space-y-8">
              {EMBED_VARIANTS.map((variant) => {
                const size = EMBED_SIZES[variant];
                return (
                  <li key={variant} id={variant}>
                    <p className="type-eyebrow">
                      {size.label} · {size.width}×{size.height}
                    </p>
                    <p className="mt-3 text-sm text-muted">Board is empty — snippets still work once a mint is live.</p>
                    <div className="mt-3">
                      <CopySnippet mint={mint} variant={variant} title={title} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="mt-10 border-t border-border pt-6">
          <h2 className="display text-lg text-ink">Public JSON</h2>
          <p className="mt-3 text-pretty text-sm text-muted">
            CORS is open. Stable enough to render a “Verified” chip without framing.
          </p>
          <pre className="mt-4 overflow-x-auto border border-border bg-panel p-3 font-mono text-[11px] text-muted">
            {`GET /api/public/coin/{mint}
GET /api/public/board
GET /api/public/radar
GET /api/public/index
GET /api/public/flags`}
          </pre>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            {API_FIELDS.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                <dt className="font-mono text-[11px] text-ink">{k}</dt>
                <dd className="text-pretty text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-10 text-pretty text-[12.5px] text-dim">
          Powered by Crosscheck · launched on ansem.io. Independent score, not the official z500 formula.
        </p>
      </main>
    </div>
  );
}
