import { cn } from "@/lib/cn";
import type { TradeLinks } from "@/lib/links";

export function TradeMark({
  name,
  className,
}: {
  name: keyof TradeLinks;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 text-accent", className)} aria-hidden fill="currentColor">
      {name === "ansem" && <path d="M8 1.6 14.4 14.2H11l-.9-1.9H5.9l-.9 1.9H1.6L8 1.6Zm0 4.1L6.4 9.4h3.2L8 5.7Z" />}
      {name === "bullpen" && (
        <path d="M1.2 4.2 4 6.2 5.3 3.8 8 6l2.7-2.2 1.3 2.4 2.8-2 0.4 2.2-2.6 1.4c.3 2.4-1.3 5.2-4.6 5.8-3.3-.6-4.9-3.4-4.6-5.8L.8 6.4 1.2 4.2Zm6.8 3.1c-1.7 0-2.6 1.2-2.6 2.4S6.3 12 8 12s2.6-1.2 2.6-2.3S9.7 7.3 8 7.3Z" />
      )}
      {name === "axiom" && <path d="M8 1.5 14.5 13.8H1.5L8 1.5Zm0 4.4L5.1 11.4h5.8L8 5.9Z" />}
      {name === "jupiter" && (
        <>
          <path d="M8 3.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 1.6a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" />
          <path d="M1.4 7.2h13.2v1.6H1.4z" />
        </>
      )}
      {name === "dex" && (
        <path d="M2.2 10.6h1.8V13H2.2zm2.2-4h1.8V13H4.4zM6.6 6.2h1.8v6.8H6.6zm2.2-3.4h1.8V13H8.8zm2.2 5.2h1.8V13h-1.8z" />
      )}
      {name === "gmgn" && (
        <path d="M3 2.2h10a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H3A1.8 1.8 0 0 1 1.2 12V4A1.8 1.8 0 0 1 3 2.2Zm1.6 2.8v6h3.4V9.6H6.2V6.6h4.6V5H4.6Z" />
      )}
      {name === "pump" && (
        <path d="M2.2 6.2 5 3.4h1.6l1.4 1.4L9.4 3.4H11l2.8 2.8v1.2H2.2V6.2Zm1.4 2.8h8.8V13H3.6V9Z" />
      )}
      {name === "solscan" && (
        <path d="M7.2 1.6a5.6 5.6 0 1 1-3.7 9.8L1.6 14.4l1.1 1.1 1.9-3a5.6 5.6 0 0 1 2.6.5 5.6 5.6 0 0 0 0-11.4Zm0 1.8a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
      )}
    </svg>
  );
}
