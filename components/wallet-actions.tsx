"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Reveal } from "@/components/reveal";

export function WalletActions({
  wallet,
  exhausted,
}: {
  wallet: string;
  exhausted?: boolean;
}) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setError(null);
    } catch {
      setError("Couldn't copy the address.");
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, deep: !exhausted }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error);
      router.refresh();
    } catch {
      setError("Couldn't reach Solana RPC — try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="type-btn h-8 border border-border px-3 text-muted hover:text-ink"
        >
          {copied ? "Copied" : "Copy address"}
        </button>
        <button
          type="button"
          onClick={verify}
          disabled={verifying}
          className="type-btn h-8 border border-accent bg-accent px-3 font-semibold text-void disabled:opacity-40"
        >
          {verifying ? "Checking…" : exhausted === false ? "Check older burns" : "Check burns"}
        </button>
      </div>
      <Reveal show={!!error}>
        <p className="mt-3 text-sm text-bad">{error}</p>
      </Reveal>
    </div>
  );
}
