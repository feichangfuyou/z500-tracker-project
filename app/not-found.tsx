import Link from "next/link";
import { FadeIn } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <SiteHeader />
      <FadeIn className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="type-eyebrow">Missing page</p>
        <p className="max-w-md text-pretty text-sm text-muted">That URL is not on Crosscheck.</p>
        <Link href="/" className="type-btn h-8 border border-accent bg-accent px-4 font-semibold text-void">
          Back to the board
        </Link>
      </FadeIn>
    </div>
  );
}
