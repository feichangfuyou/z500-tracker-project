export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M6 26 L16 7 L26 26" fill="none" stroke="currentColor" className="text-accent" strokeWidth="2.4" />
      <path d="M11 26 L16 16 L21 26" fill="none" stroke="currentColor" className="text-ink" strokeWidth="1.8" />
    </svg>
  );
}
