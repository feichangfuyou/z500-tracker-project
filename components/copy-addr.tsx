"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function CopyAddr({
  value,
  label = "address",
  className,
  onError,
}: {
  value: string;
  label?: string;
  className?: string;
  onError?: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const reset = useRef(0);
  const message = failed ? `Couldn't copy the ${label}.` : copied ? `${label} copied` : `Copy ${label}`;

  return (
    <button
      type="button"
      aria-label={message}
      title={message}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          window.clearTimeout(reset.current);
          setCopied(true);
          setFailed(false);
          reset.current = window.setTimeout(() => setCopied(false), 1600);
        } catch {
          window.clearTimeout(reset.current);
          setCopied(false);
          setFailed(true);
          onError?.(`Couldn't copy the ${label}.`);
        }
      }}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center p-0 align-middle leading-none",
        failed ? "text-bad" : copied ? "text-good" : "text-dim hover:text-ink",
        className,
      )}
    >
      {copied ? <Check size={12} strokeWidth={1.6} className="block" /> : <Copy size={12} strokeWidth={1.6} className="block" />}
    </button>
  );
}
