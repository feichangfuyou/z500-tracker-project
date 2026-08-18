import { cn } from "@/lib/cn";

export function AnsemCta({
  href,
  children,
  primary = false,
  className,
}: {
  href: string;
  children: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "type-btn inline-flex h-9 items-center px-3 sm:h-8",
        primary
          ? "border border-accent bg-accent font-semibold text-void"
          : "border border-border text-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </a>
  );
}
