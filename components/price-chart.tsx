"use client";

import { useState } from "react";
import { dexEmbedUrl } from "@/lib/links";

export function PriceChart({ name, dexUrl }: { name: string; dexUrl: string }) {
  const embed = dexEmbedUrl(dexUrl);
  const [live, setLive] = useState(false);
  return (
    <section className="mt-6 min-w-0 border-t border-border pt-6">
      <h2 className="sr-only">Price</h2>
      {embed ? (
        <div className="relative" onMouseLeave={() => setLive(false)}>
          <iframe
            src={embed}
            title={`${name} chart on DexScreener`}
            className="block h-[32rem] w-full border border-border bg-panel lg:h-[36rem]"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="clipboard-write"
            tabIndex={live ? 0 : -1}
          />
          {live ? null : (
            <div
              role="presentation"
              className="absolute inset-0"
              style={{ touchAction: "pan-y" }}
              onClick={() => setLive(true)}
            />
          )}
        </div>
      ) : (
        <p className="border border-border px-3 py-10 text-center text-sm text-pretty text-muted">
          Chart needs a DexScreener pair.{" "}
          <a href={dexUrl} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">
            Open DexScreener
          </a>
        </p>
      )}
    </section>
  );
}
