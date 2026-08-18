"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { publicImageUrl } from "@/lib/media";

export function CoinThumb({
  src,
  label,
  className,
  size = 32,
}: {
  src?: string | null;
  label: string;
  className?: string;
  size?: number;
}) {
  const safe = publicImageUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = Boolean(safe && failedSrc === safe);

  if (safe && !broken) {
    return (
      <Image
        src={safe}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className={cn("size-8 shrink-0 rounded-[3px] border border-border bg-raised object-cover", className)}
        onError={() => setFailedSrc(safe)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[3px] border border-border bg-raised font-mono text-xs text-dim",
        className,
      )}
    >
      {label.slice(0, 1)}
    </span>
  );
}
