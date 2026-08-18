import { dexEmbedUrl } from "@/lib/links";

export function PriceChart({ name, dexUrl }: { name: string; dexUrl: string }) {
  const embed = dexEmbedUrl(dexUrl);
  return (
    <section className="mt-6 min-w-0 border-t border-border pt-6">
      <h2 className="sr-only">Price</h2>
      {embed ? (
        <iframe
          src={embed}
          title={`${name} chart on DexScreener`}
          className="block h-[36rem] w-full border border-border bg-panel"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write"
        />
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
