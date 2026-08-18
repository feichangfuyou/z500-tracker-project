"use client";

import { cn } from "@/lib/cn";
import { useScramble } from "@/lib/scramble";

export function ScrambleText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { display, start, stop } = useScramble(text);
  return (
    <span
      className={cn("inline-block max-w-full", className)}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
