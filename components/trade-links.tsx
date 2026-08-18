"use client";

import { cn } from "@/lib/cn";
import { LINK_ORDER, tradeLinks, type TradeLinks } from "@/lib/links";
import { useScramble } from "@/lib/scramble";
import { TradeMark } from "@/components/trade-mark";

export function TradeLinks({
  mint,
  slug,
  className,
  embedded = false,
}: {
  mint: string;
  slug?: string | null;
  className?: string;
  embedded?: boolean;
}) {
  const links = tradeLinks(mint, slug);
  const items = LINK_ORDER.flatMap((item) => {
    const href = links[item.key];
    return href ? [{ ...item, href }] : [];
  });

  if (embedded) {
    return (
      <nav className={cn("flex border-t border-border bg-panel", className)} aria-label="Trade and explorers">
        {items.map((item, i) => (
          <TradeLink
            key={item.key}
            item={item}
            embedded
            className={cn(
              "flex h-10 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-muted hover:bg-row hover:text-ink",
              i !== items.length - 1 && "border-r border-border",
            )}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn("flex flex-wrap gap-x-4 gap-y-2", className)} aria-label="Trade and explorers">
      {items.map((item) => (
        <TradeLink
          key={item.key}
          item={item}
          className="type-btn inline-flex min-h-8 items-center gap-1.5 text-[11px] text-muted hover:text-ink"
        />
      ))}
    </nav>
  );
}

function TradeLink({
  item,
  embedded = false,
  className,
}: {
  item: (typeof LINK_ORDER)[number] & { href: string; key: keyof TradeLinks };
  embedded?: boolean;
  className?: string;
}) {
  const text = embedded ? item.abbr : item.label;
  const { display, start, stop } = useScramble(text);
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      title={item.label}
      className={className}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <span className="sr-only">{item.label}</span>
      <TradeMark name={item.key} className={embedded ? undefined : "size-3"} />
      <span aria-hidden="true" className={cn(embedded && "type-btn max-w-full truncate px-0.5 text-[8px] leading-none")}>
        {display}
      </span>
    </a>
  );
}
