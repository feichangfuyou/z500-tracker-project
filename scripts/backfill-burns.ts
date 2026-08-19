import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pendingFirstPass } from "../lib/scan";
import { runScanPass } from "../lib/scan-pass";
import { readStore } from "../lib/store";
import { ANSEM_MINT } from "../lib/types";

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

function pendingFromStore(store: Awaited<ReturnType<typeof readStore>>) {
  const coins = (store.coinSnapshot.coins || []) as { nsfw?: boolean; mint?: string; creatorWallet?: string; createdAt?: string; tier?: unknown }[];
  const visible = coins.filter((c) => c.mint && c.mint !== ANSEM_MINT);
  const now = Date.now();
  const targets = [
    ...visible
      .filter((c) => c.creatorWallet)
      .map((c) => ({
        wallet: c.creatorWallet as string,
        mint: c.mint || "",
        tier: "Free",
        addedAt: c.createdAt ? Date.parse(c.createdAt) : now,
      })),
    ...store.community
      .filter((p) => !p.hidden && p.launchWallet)
      .map((p) => ({
        wallet: p.launchWallet as string,
        mint: p.mint,
        tier: p.tier,
        addedAt: p.addedAt,
      })),
  ];
  return pendingFirstPass(targets, store.burns);
}

async function main() {
  const rounds = Number(process.env.BACKFILL_ROUNDS || 12);
  const maxMs = Number(process.env.BACKFILL_MS || 240_000);
  console.log(`backfill start rounds=${rounds} maxMs=${maxMs}`);
  for (let round = 1; round <= rounds; round += 1) {
    const started = Date.now();
    const result = await runScanPass({ maxMs });
    const store = await readStore();
    const pending = pendingFromStore(store);
    const indexed = Object.values(store.burns).filter((b) => b.indexedBy === "helius").length;
    const exhausted = Object.values(store.burns).filter((b) => b.exhausted).length;
    const unfinished = Object.values(store.burns).filter((b) => !b.exhausted).length;
    const nonzero = Object.values(store.burns).filter((b) => (b.verifiedBurn || 0) > 0).length;
    console.log(
      JSON.stringify({
        round,
        ms: Date.now() - started,
        scanned: result.scanned,
        errors: result.errors,
        mode: result.mode,
        pending: result.pending,
        pendingNow: pending,
        indexed,
        exhausted,
        unfinished,
        nonzero,
        lastWallet: result.lastWallet,
      }),
    );
    if (pending === 0 && unfinished === 0) break;
    if (result.scanned === 0 && result.errors === 0 && pending === 0) break;
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("backfill failed", msg.replace(/api-key=[^&\s]+/gi, "api-key=[redacted]"));
  process.exit(1);
});
