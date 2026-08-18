import { LINK_ORDER, tradeLinks } from "@/lib/links";

export function TradeLinks({ mint, slug }: { mint: string; slug?: string | null }) {
  const links = tradeLinks(mint, slug);
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Trade and explorers">
      {LINK_ORDER.map((item) => {
        const href = links[item.key];
        if (!href) return null;
        return (
          <a
            key={item.key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="type-btn inline-flex min-h-8 items-center text-[11px] text-muted hover:text-ink"
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
