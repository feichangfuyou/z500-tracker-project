"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CopyAddr } from "@/components/copy-addr";
import { LiveNum } from "@/components/live-num";
import { PageBack } from "@/components/page-back";
import { Reveal } from "@/components/reveal";
import { ScrambleText } from "@/components/scramble-text";
import { shortAddr } from "@/lib/format";

type Item = {
  id: string;
  mint: string;
  projectId: string;
  status: string;
  createdAt: number;
  name: string;
  reports: number;
  hidden: boolean;
};

export default function ModPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<{ telegram: boolean; discord: boolean } | null>(null);
  const [alertNote, setAlertNote] = useState<string | null>(null);

  const loadAlerts = async () => {
    const res = await fetch("/api/mod/alerts");
    if (res.ok) setAlerts(await res.json());
  };

  const load = async () => {
    const res = await fetch("/api/mod/queue");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const json = await res.json();
    setAuthed(true);
    setQueue(json.queue || []);
    await loadAlerts();
  };

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/mod/queue", { signal: ac.signal })
      .then(async (res) => {
        if (res.status === 401) {
          setAuthed(false);
          return;
        }
        const json = (await res.json()) as { queue?: Item[] };
        setAuthed(true);
        setQueue(json.queue || []);
        const alertRes = await fetch("/api/mod/alerts", { signal: ac.signal });
        if (alertRes.ok) setAlerts(await alertRes.json());
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);

  const login = async () => {
    setError(null);
    const res = await fetch("/api/mod/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      setError("Bad key.");
      return;
    }
    await load();
  };

  const act = async (id: string, action: "hide" | "dismiss" | "restore") => {
    await fetch("/api/mod/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await load();
  };

  return (
    <div className="gutter-x min-h-dvh bg-bg py-10 text-ink">
      <div className="mx-auto max-w-3xl">
        <p className="type-eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <PageBack href="/" />
          <span>
            <Link href="/" className="text-muted hover:text-ink">
              <ScrambleText text="Tracker" />
            </Link>
            {" · "}moderation
          </span>
        </p>
        <h1 className="display display-title mt-3 text-balance text-ink">Queue</h1>
        <p className="mt-3 max-w-lg text-pretty text-sm text-muted">
          Community reports land here. Hide, restore, or dismiss. Tape alerts fire from cron when Telegram or Discord
          env is set.
        </p>

        {!authed ? (
          <form
            className="mt-8 flex flex-col gap-3 min-[360px]:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Mod key"
            className="h-11 min-w-0 w-full border border-input-border bg-input px-3 text-base text-ink min-[360px]:flex-1 sm:h-8 sm:text-sm"
            />
            <button
              type="submit"
              className="type-btn h-8 shrink-0 border border-accent bg-accent px-4 font-semibold text-void"
            >
              <ScrambleText text="Unlock" />
            </button>
          </form>
        ) : (
          <>
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="type-eyebrow">Closed-tab alerts</h2>
              <p className="mt-3 font-mono text-sm text-ink">
                Telegram {alerts?.telegram ? "on" : "off"} · Discord {alerts?.discord ? "on" : "off"}
              </p>
              <p className="mt-2 max-w-lg text-pretty text-[12.5px] text-dim">
                Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID and/or DISCORD_WEBHOOK_URL on the host. Test sends one
                unofficial tape line with ansem.io CTAs.
              </p>
              <button
                type="button"
                onClick={async () => {
                  setAlertNote(null);
                  const res = await fetch("/api/mod/alerts", { method: "POST" });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setAlertNote(json.error || "Couldn't send a test.");
                    return;
                  }
                  setAlertNote("Test sent.");
                  setAlerts({ telegram: Boolean(json.telegram), discord: Boolean(json.discord) });
                }}
                className="type-btn mt-3 h-8 border border-border px-3 text-muted hover:text-ink"
              >
                <ScrambleText text="Send test" />
              </button>
              <Reveal show={!!alertNote}>
                <p className="mt-2 text-sm text-muted">{alertNote}</p>
              </Reveal>
            </section>
            {queue.length === 0 ? (
          <Reveal show>
            <p className="mt-8 text-sm text-muted">No reports in the queue.</p>
          </Reveal>
        ) : (
          <ul className="mt-6 border border-border">
            {queue.map((item) => (
              <li key={item.id} className="border-b border-border px-4 py-4 last:border-b-0 hover:bg-row">
                <div className="flex flex-col gap-3 min-[400px]:flex-row min-[400px]:items-start min-[400px]:justify-between">
                  <div className="min-w-0">
                    <Link href={`/c/${item.mint}`} className="block truncate text-[13px] font-medium text-ink hover:text-gold-lit">
                      {item.name}
                    </Link>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-dim">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Link href={`/c/${item.mint}`} className="hover:text-ink">
                          {shortAddr(item.mint)}
                        </Link>
                        <CopyAddr value={item.mint} label="mint address" />
                      </span>
                      <span>
                        <LiveNum value={item.reports} format="int" flash={false} /> reports · {item.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <button type="button" onClick={() => act(item.id, "hide")} className="type-btn text-bad">
                      <ScrambleText text="Hide" />
                    </button>
                    <button type="button" onClick={() => act(item.id, "restore")} className="type-btn text-good">
                      <ScrambleText text="Restore" />
                    </button>
                    <button type="button" onClick={() => act(item.id, "dismiss")} className="type-btn text-muted">
                      <ScrambleText text="Dismiss" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
            )}
          </>
        )}
        <Reveal show={!!error}>
          <p className="mt-3 text-sm text-bad">{error}</p>
        </Reveal>
      </div>
    </div>
  );
}
