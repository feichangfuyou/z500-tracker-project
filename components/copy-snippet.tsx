"use client";

import { useState } from "react";
import { Reveal } from "@/components/reveal";
import { ScrambleText } from "@/components/scramble-text";
import { EMBED_SIZES, embedPath, iframeSnippet, type EmbedVariant } from "@/lib/embed";

export function CopySnippet({
  mint,
  variant,
  title,
}: {
  mint: string;
  variant: EmbedVariant;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = EMBED_SIZES[variant];
  const preview = `<iframe src="…${embedPath(mint, variant)}" width="${width}" height="${height}" style="border:0" loading="lazy" title="${title.replace(/[<>"]/g, "")} Crosscheck"></iframe>`;

  return (
    <div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
        <pre className="min-w-0 flex-1 overflow-x-auto border border-border bg-panel p-3 font-mono text-[11px] text-muted">
          {preview}
        </pre>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(iframeSnippet(window.location.origin, mint, variant, title));
              setCopied(true);
              setError(null);
            } catch {
              setError("Couldn't copy.");
            }
          }}
          className="type-btn h-9 shrink-0 border border-border px-3 text-muted hover:text-ink sm:h-8"
        >
          <ScrambleText text={copied ? "Copied" : "Copy"} />
        </button>
      </div>
      <Reveal show={!!error}>
        <p className="mt-2 text-sm text-bad">{error}</p>
      </Reveal>
    </div>
  );
}
