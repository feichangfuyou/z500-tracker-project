"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ScrambleText } from "@/components/scramble-text";

export function PageBack({ href }: { href: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        const ref = document.referrer;
        if (ref) {
          try {
            if (new URL(ref).origin === window.location.origin) {
              router.back();
              return;
            }
          } catch {
            /* fall through to the section root */
          }
        }
        router.push(href);
      }}
      className="type-eyebrow inline-flex items-center gap-0.5 text-muted hover:text-ink"
    >
      <ChevronLeft size={12} strokeWidth={2} aria-hidden />
      <ScrambleText text="Back" />
    </button>
  );
}
