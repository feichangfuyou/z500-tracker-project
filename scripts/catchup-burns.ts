import { existsSync, readFileSync, writeSync } from "node:fs";
import { resolve } from "node:path";
import { isTransferCursor } from "../lib/helius";
import { indexTransferBurns, probeTransferApi } from "../lib/helius-transfers";
import { readStore, withStore } from "../lib/store";
import type { BurnCache } from "../lib/types";

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(resolve(process.cwd(), ".env.local"));

function log(row: Record<string, unknown>) {
  writeSync(1, `${JSON.stringify(row)}\n`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, n) }, async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

function unfinished(burns: Record<string, BurnCache>) {
  return Object.values(burns)
    .filter((b) => b.wallet && !b.exhausted)
    .sort((a, b) => (a.txChecked || 0) - (b.txChecked || 0) || a.scannedAt - b.scannedAt);
}

async function drainWallet(cached: BurnCache, paceMs: number) {
  let cursor = isTransferCursor(cached.cursor) ? cached.cursor : null;
  let headSig = cached.headSig;
  let verifiedBurn = cursor ? cached.verifiedBurn || 0 : 0;
  let txChecked = cursor ? cached.txChecked || 0 : 0;
  let txBurned = cursor ? cached.txBurned || 0 : 0;
  let exhausted = false;
  let hops = 0;
  let errors = 0;

  while (!exhausted && hops < 8) {
    hops += 1;
    const resume = isTransferCursor(cursor);
    const scan = await indexTransferBurns(cached.wallet, {
      mode: resume ? "older" : "fresh",
      cursor,
      headSig,
      maxPages: 40,
      deadline: Date.now() + 45_000,
      paceMs,
      reindex: !resume,
    });
    if (scan && "unavailable" in scan) {
      return { unavailable: true as const, wallet: cached.wallet, hops, errors };
    }
    if (!scan) {
      errors += 1;
      await sleep(Math.min(8_000, 1_500 * errors));
      if (errors >= 3) break;
      continue;
    }
    if (scan.replace || !resume) {
      verifiedBurn = scan.verifiedBurn;
      txChecked = scan.txChecked;
      txBurned = scan.txBurned;
    } else {
      verifiedBurn += scan.verifiedBurn;
      txChecked += scan.txChecked;
      txBurned += scan.txBurned;
    }
    cursor = scan.cursor;
    headSig = scan.headSig ?? headSig;
    exhausted = scan.exhausted;
    if (!exhausted && scan.txChecked === 0) {
      errors += 1;
      await sleep(2_000);
    }
  }

  return {
    wallet: cached.wallet,
    verifiedBurn,
    txChecked,
    txBurned,
    scannedAt: Date.now(),
    cursor,
    exhausted,
    headSig,
    indexedBy: "helius" as const,
    hops,
    errors,
  };
}

const LOCK_MS = 90 * 60 * 1000;

function asBurn(next: BurnCache): BurnCache {
  return {
    wallet: next.wallet,
    verifiedBurn: next.verifiedBurn,
    txChecked: next.txChecked,
    txBurned: next.txBurned,
    scannedAt: next.scannedAt,
    cursor: next.cursor,
    exhausted: next.exhausted,
    headSig: next.headSig,
    indexedBy: "helius",
  };
}

async function persistLock(until: number) {
  await withStore((s) => {
    s.scanLockUntil = until;
  });
}

async function persistBurns(batch: BurnCache[], lockUntil: number) {
  if (!batch.length) return;
  await withStore((s) => {
    s.scanLockUntil = lockUntil;
    for (const next of batch) s.burns[next.wallet] = asBurn(next);
    s.scanCursor = {
      at: Date.now(),
      scanned: (s.scanCursor.scanned || 0) + batch.length,
      lastWallet: batch[batch.length - 1]?.wallet || s.scanCursor.lastWallet,
      errors: s.scanCursor.errors || 0,
    };
  });
}

async function main() {
  if (process.argv.includes("--unlock")) {
    await persistLock(0);
    log({ unlocked: true });
    return;
  }
  if (process.argv.includes("--probe")) {
    const store = await readStore();
    const sample = unfinished(store.burns)[0] || Object.values(store.burns).find((b) => b.wallet);
    if (!sample) {
      log({ probe: true, ok: false, error: "no-wallets" });
      process.exitCode = 1;
      return;
    }
    const result = await probeTransferApi(sample.wallet);
    log({
      probe: true,
      method: "getTransfersByAddress",
      creditsPerPage: 10,
      wallet: sample.wallet,
      status: result.status,
      ok: result.ok,
      unavailable: result.unavailable,
      transfers: result.transfers,
      burns: result.burns,
      verifiedBurn: "verifiedBurn" in result ? result.verifiedBurn : 0,
      pagination: "pagination" in result ? result.pagination : false,
    });
    if (!result.ok) process.exitCode = 1;
    return;
  }
  process.env.HELIUS_INDEX = "transfers";
  const paceMs = Number(process.env.CATCHUP_PACE_MS || 50);
  const concurrency = Number(process.env.CATCHUP_CONCURRENCY || 6);
  const chunkSize = Number(process.env.CATCHUP_CHUNK || 24);
  const started = Date.now();
  await persistLock(started + LOCK_MS);
  log({ start: true, method: "getTransfersByAddress", creditsPerPage: 10, paceMs, concurrency, chunkSize });

  let sweeps = 0;
  let done = 0;
  try {
    while (sweeps < 8) {
      sweeps += 1;
      const store = await withStore((s) => s, { persist: false });
      const queue = unfinished(store.burns);
      log({ sweep: sweeps, left: queue.length, exhausted: Object.values(store.burns).filter((b) => b.exhausted).length });
      if (!queue.length) break;

      let progressed = 0;
      for (let offset = 0; offset < queue.length; offset += chunkSize) {
        const chunk = queue.slice(offset, offset + chunkSize);
        const results: BurnCache[] = [];
        await pool(chunk, concurrency, async (cached, idx) => {
          log({ i: offset + idx + 1, of: queue.length, wallet: cached.wallet, start: true });
          const hopStarted = Date.now();
          const next = await drainWallet(cached, paceMs);
          if ("unavailable" in next) {
            log({ unavailable: true, method: "getTransfersByAddress", wallet: next.wallet });
            throw new Error("getTransfersByAddress unavailable");
          }
          results[idx] = asBurn(next);
          if (next.exhausted) {
            done += 1;
            progressed += 1;
          }
          log({
            i: offset + idx + 1,
            of: queue.length,
            wallet: next.wallet,
            exhausted: next.exhausted,
            txChecked: next.txChecked,
            burned: next.verifiedBurn,
            hops: next.hops,
            errors: next.errors,
            ms: Date.now() - hopStarted,
            finished: done,
          });
        });
        await persistBurns(
          results.filter(Boolean),
          Date.now() + LOCK_MS,
        );
        log({ flushed: results.filter(Boolean).length, finished: done, left: queue.length - offset - chunk.length });
      }
      if (!progressed) {
        log({ stuck: true, sweep: sweeps });
        break;
      }
    }
  } finally {
    await persistLock(0);
  }

  const store = await readStore();
  const left = unfinished(store.burns).length;
  log({
    done: true,
    ms: Date.now() - started,
    finished: done,
    left,
    exhausted: Object.values(store.burns).filter((b) => b.exhausted).length,
    indexed: Object.values(store.burns).length,
    nonzero: Object.values(store.burns).filter((b) => (b.verifiedBurn || 0) > 0).length,
  });
  if (left > 0) process.exitCode = 1;
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("catchup failed", msg.replace(/api-key=[^&\s]+/gi, "api-key=[redacted]"));
  persistLock(0).finally(() => process.exit(1));
});
