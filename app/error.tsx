"use client";

import { FadeIn } from "@/components/reveal";
import { ScrambleText } from "@/components/scramble-text";

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FadeIn className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="type-eyebrow">Something broke</p>
      <p className="max-w-md text-pretty text-sm text-muted">
        Something broke while loading the tracker. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="type-btn h-8 border border-accent bg-accent px-4 font-semibold text-void"
      >
        <ScrambleText text="Try again" />
      </button>
    </FadeIn>
  );
}
