import type { Metadata } from "next";
import { PageBack } from "@/components/page-back";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Crosscheck uses a session cookie and optional watch wallet. Unofficial tracker — not ansem.io.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <SiteHeader />
      <main className="gutter-x mx-auto max-w-[720px] py-10">
        <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <PageBack href="/" />
          <span>Privacy</span>
        </p>
        <h1 className="display display-title mt-3 text-balance">What this site stores</h1>
        <div className="mt-6 space-y-4 text-pretty text-sm text-muted">
          <p>
            Crosscheck is an unofficial tracker. It is not ansem.io and is not financial advice. We do not sell
            personal data.
          </p>
          <p>
            A session cookie (`tracker_sid`) is set so this browser can edit or report community-added coins and keep a
            watchlist. It is httpOnly, SameSite=Lax, and lasts a year. Optional watch sync can store a Solana address
            you paste; that is only used to merge lists.
          </p>
          <p>
            Moderation uses a separate cookie after a shared key login. Cron and RPC checks run on the server. Public
            JSON endpoints do not include session ids.
          </p>
          <p>Paste-wallet lookups (airdrop P&L) are request-time only. We do not keep a ledger of those addresses.</p>
        </div>
      </main>
    </div>
  );
}
