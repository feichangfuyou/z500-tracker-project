import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseFlagLedger } from "./flag-ledger";
import { parseBurnHits, parseMintBurnIndex, pruneBurnHits, seedBurnHits } from "./burn-index";
import { slimRemoteStore } from "./store-slim";
import type { AttributedBurn, BoostSeen, BurnCache, CommunityProject, DexCache, Dossier, FlagIssued, HolderCache, IndexDay, LedgerHit, MintBurnIndex, MintStatus, RankSnapshot, ScanCursor, Store, TapeEvent } from "./types";

const DIR = process.env.VERCEL
  ? path.join("/tmp", "crosscheck-data")
  : path.join(process.cwd(), "data");
const DB_FILE = path.join(DIR, "crosscheck.db");
const LEGACY = path.join(DIR, "store.json");

type Statement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

type Db = {
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
};

type StoreGlobal = typeof globalThis & {
  __crosscheckDb?: Db;
  __crosscheckQueue?: Promise<unknown>;
  __crosscheckStoreRead?: { at: number; value: Store };
};

const STORE_READ_MS = 5_000;

const g = globalThis as StoreGlobal;
let db: Db | null = g.__crosscheckDb ?? null;
let queue: Promise<unknown> = g.__crosscheckQueue ?? Promise.resolve();

function getDb(): Db | null {
  if (db) return db;
  if (g.__crosscheckDb) {
    db = g.__crosscheckDb;
    return db;
  }
  mkdirSync(DIR, { recursive: true });
  let opened: Db;
  try {
    opened = new DatabaseSync(DB_FILE, { timeout: 5000 }) as unknown as Db;
  } catch {
    return null;
  }
  opened.exec(`
    CREATE TABLE IF NOT EXISTS community (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mint TEXT NOT NULL,
      tier TEXT NOT NULL,
      launch_wallet TEXT,
      burn_amount REAL NOT NULL DEFAULT 0,
      burn_price_ref REAL NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL,
      added_by TEXT NOT NULL,
      reports INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS burns (
      wallet TEXT PRIMARY KEY,
      verified_burn REAL NOT NULL,
      tx_checked INTEGER NOT NULL,
      tx_burned INTEGER NOT NULL,
      scanned_at INTEGER NOT NULL,
      cursor TEXT,
      exhausted INTEGER NOT NULL,
      head_sig TEXT
    );
    CREATE TABLE IF NOT EXISTS holders (
      mint TEXT PRIMARY KEY,
      top10_pct REAL NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS add_log (
      sid TEXT NOT NULL,
      ip TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      mint TEXT NOT NULL,
      sid TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (mint, sid)
    );
    CREATE TABLE IF NOT EXISTS provenance (
      mint TEXT PRIMARY KEY,
      creator TEXT,
      status TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coin_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS moderation (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS extra (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watches (
      key TEXT PRIMARY KEY,
      mints TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rev INTEGER NOT NULL DEFAULT 0
    );
  `);
  try {
    opened.exec(`
      CREATE TABLE IF NOT EXISTS extra (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS watches (
        key TEXT PRIMARY KEY,
        mints TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        rev INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch {
    /* already present */
  }
  const cols = opened.prepare("PRAGMA table_info(burns)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "head_sig")) {
    opened.exec("ALTER TABLE burns ADD COLUMN head_sig TEXT");
  }
  if (!cols.some((c) => c.name === "indexed_by")) {
    opened.exec("ALTER TABLE burns ADD COLUMN indexed_by TEXT");
  }
  const holderCols = opened.prepare("PRAGMA table_info(holders)").all() as { name: string }[];
  if (!holderCols.some((c) => c.name === "sniper")) {
    opened.exec("ALTER TABLE holders ADD COLUMN insider_pct REAL");
    opened.exec("ALTER TABLE holders ADD COLUMN sniper INTEGER NOT NULL DEFAULT 0");
    opened.exec("ALTER TABLE holders ADD COLUMN clustered INTEGER NOT NULL DEFAULT 0");
  }
  if (!holderCols.some((c) => c.name === "holders_json")) {
    opened.exec("ALTER TABLE holders ADD COLUMN holders_json TEXT");
  }
  db = opened;
  g.__crosscheckDb = opened;
  try {
    opened.exec("ALTER TABLE burns ADD COLUMN head_sig TEXT");
  } catch {
    /* already present */
  }
  migrateLegacy(opened);
  return opened;
}

function migrateLegacy(opened: Db) {
  if (!existsSync(LEGACY)) return;
  const already = opened.prepare("SELECT COUNT(*) AS n FROM community").get() as { n: number } | undefined;
  if (already && already.n > 0) return;
  try {
    const raw = JSON.parse(readFileSync(LEGACY, "utf8")) as Store;
    persist(opened, { ...empty(), ...raw });
  } catch {
    /* ignore broken legacy file */
  }
}

type Extra = {
  dex: Record<string, DexCache>;
  scanCursor: ScanCursor;
  rankSnapshot: RankSnapshot;
  tape: TapeEvent[];
  rankHistory: RankSnapshot[];
  seenMints: string[];
  mintStatus: MintStatus;
  boostSeen: BoostSeen;
  watches: Record<string, string[]>;
  dossiers: Record<string, Dossier>;
  indexDays: IndexDay[];
  burnLedger: LedgerHit[];
  burnHits: Record<string, LedgerHit>;
  mintBurnIndex: MintBurnIndex;
  attributedBurns: Record<string, AttributedBurn>;
  projectBurns: Record<string, { amount: number; burners: number }>;
  flagsIssued: FlagIssued[];
  webhookAt: number | null;
};

const emptyExtra = (): Extra => ({
  dex: {},
  scanCursor: { at: 0, scanned: 0, lastWallet: null, errors: 0 },
  rankSnapshot: { at: 0, ranks: {} },
  tape: [],
  rankHistory: [],
  seenMints: [],
  mintStatus: {},
  boostSeen: {},
  watches: {},
  dossiers: {},
  indexDays: [],
  burnLedger: [],
  burnHits: {},
  mintBurnIndex: { cursor: null, headSig: null, exhausted: false, scannedAt: 0, txChecked: 0, txBurned: 0 },
  attributedBurns: {},
  projectBurns: {},
  flagsIssued: [],
  webhookAt: null,
});

const empty = (): Store => ({
  rev: 0,
  community: [],
  burns: {},
  holders: {},
  addLog: [],
  reports: [],
  provenance: {},
  moderation: [],
  coinSnapshot: { at: 0, coins: [] },
  ...emptyExtra(),
});

function load(opened: Db): Store {
  const community = (opened.prepare("SELECT * FROM community").all() as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    mint: String(r.mint),
    tier: String(r.tier),
    launchWallet: r.launch_wallet ? String(r.launch_wallet) : null,
    burnAmount: Number(r.burn_amount) || 0,
    burnPriceRef: Number(r.burn_price_ref) || 0,
    addedAt: Number(r.added_at),
    addedBy: String(r.added_by),
    reports: Number(r.reports) || 0,
    hidden: Boolean(r.hidden),
  })) satisfies CommunityProject[];

  const burns: Record<string, BurnCache> = {};
  for (const r of opened.prepare("SELECT * FROM burns").all() as Record<string, unknown>[]) {
    const wallet = String(r.wallet);
    burns[wallet] = {
      wallet,
      verifiedBurn: Number(r.verified_burn) || 0,
      txChecked: Number(r.tx_checked) || 0,
      txBurned: Number(r.tx_burned) || 0,
      scannedAt: Number(r.scanned_at) || 0,
      cursor: r.cursor ? String(r.cursor) : null,
      exhausted: Boolean(r.exhausted),
      headSig: r.head_sig ? String(r.head_sig) : null,
      indexedBy: r.indexed_by === "helius" || r.indexed_by === "rpc" ? r.indexed_by : undefined,
    };
  }

  const holders: Store["holders"] = {};
  for (const r of opened.prepare("SELECT * FROM holders").all() as Record<string, unknown>[]) {
    holders[String(r.mint)] = {
      top10Pct: Number(r.top10_pct) || 0,
      at: Number(r.at),
      insiderPct: r.insider_pct == null ? null : Number(r.insider_pct),
      sniper: Boolean(r.sniper),
      clustered: Boolean(r.clustered),
      holders: (() => {
        try {
          const parsed = r.holders_json ? JSON.parse(String(r.holders_json)) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
    } satisfies HolderCache;
  }

  const provenance: Store["provenance"] = {};
  for (const r of opened.prepare("SELECT * FROM provenance").all() as Record<string, unknown>[]) {
    provenance[String(r.mint)] = {
      creator: r.creator ? String(r.creator) : null,
      status: String(r.status) as Store["provenance"][string]["status"],
      at: Number(r.at),
    };
  }

  const loaded: Store = {
    community,
    burns,
    holders,
    addLog: (opened.prepare("SELECT * FROM add_log").all() as Record<string, unknown>[]).map((r) => ({
      sid: String(r.sid),
      ip: String(r.ip),
      at: Number(r.at),
    })),
    reports: (opened.prepare("SELECT mint, sid, at FROM reports").all() as Record<string, unknown>[]).map((r) => ({
      mint: String(r.mint),
      sid: String(r.sid),
      at: Number(r.at),
    })),
    provenance,
    moderation: (opened.prepare("SELECT * FROM moderation").all() as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      mint: String(r.mint),
      projectId: String(r.project_id),
      status: String(r.status) as Store["moderation"][number]["status"],
      createdAt: Number(r.created_at),
    })),
    coinSnapshot: (() => {
      const row = opened.prepare("SELECT payload, at FROM coin_snapshot WHERE id = 1").get() as
        | { payload?: string; at?: number }
        | undefined;
      if (!row?.payload) return { at: 0, coins: [] as unknown[] };
      try {
        return { at: Number(row.at) || 0, coins: JSON.parse(String(row.payload)) as unknown[] };
      } catch {
        return { at: 0, coins: [] as unknown[] };
      }
    })(),
    ...(() => {
      const base = emptyExtra();
      try {
        const row = opened.prepare("SELECT payload FROM extra WHERE id = 1").get() as { payload?: string } | undefined;
        if (!row?.payload) return base;
        const parsed = JSON.parse(String(row.payload)) as Partial<ReturnType<typeof emptyExtra>>;
        return {
          dex: parsed.dex || base.dex,
          scanCursor: parsed.scanCursor || base.scanCursor,
          rankSnapshot: parsed.rankSnapshot || base.rankSnapshot,
          tape: parsed.tape || base.tape,
          rankHistory: parsed.rankHistory || base.rankHistory,
          seenMints: parsed.seenMints || base.seenMints,
          mintStatus: parsed.mintStatus || base.mintStatus,
          boostSeen: parsed.boostSeen || base.boostSeen,
          watches: parsed.watches || base.watches,
          dossiers: parsed.dossiers || base.dossiers,
          indexDays: parsed.indexDays || base.indexDays,
          burnLedger: Array.isArray(parsed.burnLedger) ? parsed.burnLedger : base.burnLedger,
          burnHits: seedBurnHits(parseBurnHits(parsed.burnHits), Array.isArray(parsed.burnLedger) ? parsed.burnLedger : []),
          mintBurnIndex: parseMintBurnIndex(parsed.mintBurnIndex),
          attributedBurns: parsed.attributedBurns && typeof parsed.attributedBurns === "object" ? parsed.attributedBurns : base.attributedBurns,
          projectBurns: parsed.projectBurns && typeof parsed.projectBurns === "object" ? parsed.projectBurns : base.projectBurns,
          flagsIssued: parseFlagLedger(parsed.flagsIssued),
          webhookAt: typeof parsed.webhookAt === "number" ? parsed.webhookAt : null,
        };
      } catch {
        return base;
      }
    })(),
    rev: Number((opened.prepare("SELECT rev FROM meta WHERE id = 1").get() as { rev?: number } | undefined)?.rev) || 0,
  };
  const watchRows = opened.prepare("SELECT key, mints FROM watches").all() as { key: string; mints: string }[];
  if (watchRows.length) {
    const watches: Record<string, string[]> = { ...(loaded.watches || {}) };
    for (const row of watchRows) {
      try {
        const parsed = JSON.parse(String(row.mints));
        if (Array.isArray(parsed)) watches[String(row.key)] = parsed.filter((m) => typeof m === "string");
      } catch {
        /* skip */
      }
    }
    loaded.watches = watches;
  }
  return loaded;
}

function pruneKeys(opened: Db, table: string, col: string, keys: string[]) {
  if (!keys.length) {
    opened.exec(`DELETE FROM ${table}`);
    return;
  }
  const existing = opened.prepare(`SELECT ${col} AS k FROM ${table}`).all() as { k: string }[];
  const keep = new Set(keys);
  const gone = existing.map((r) => String(r.k)).filter((k) => !keep.has(k));
  for (let i = 0; i < gone.length; i += 400) {
    const part = gone.slice(i, i + 400);
    opened.prepare(`DELETE FROM ${table} WHERE ${col} IN (${part.map(() => "?").join(",")})`).run(...part);
  }
}

function persist(opened: Db, store: Store) {
  opened.exec("BEGIN");
  try {
    pruneKeys(opened, "community", "id", store.community.map((p) => p.id));
    const insC = opened.prepare(
      "INSERT OR REPLACE INTO community VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const p of store.community) {
      insC.run(p.id, p.name, p.mint, p.tier, p.launchWallet, p.burnAmount, p.burnPriceRef, p.addedAt, p.addedBy, p.reports, p.hidden ? 1 : 0);
    }
    pruneKeys(opened, "burns", "wallet", Object.keys(store.burns));
    const insB = opened.prepare("INSERT OR REPLACE INTO burns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const b of Object.values(store.burns)) {
      insB.run(
        b.wallet,
        b.verifiedBurn,
        b.txChecked,
        b.txBurned,
        b.scannedAt,
        b.cursor,
        b.exhausted ? 1 : 0,
        b.headSig,
        b.indexedBy || null,
      );
    }
    pruneKeys(opened, "holders", "mint", Object.keys(store.holders));
    const insH = opened.prepare(
      "INSERT OR REPLACE INTO holders (mint, top10_pct, at, insider_pct, sniper, clustered, holders_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const [mint, h] of Object.entries(store.holders)) {
      insH.run(
        mint,
        h.top10Pct,
        h.at,
        h.insiderPct ?? null,
        h.sniper ? 1 : 0,
        h.clustered ? 1 : 0,
        JSON.stringify((h.holders || []).slice(0, 20)),
      );
    }
    opened.exec("DELETE FROM add_log");
    const insA = opened.prepare("INSERT INTO add_log VALUES (?, ?, ?)");
    for (const e of store.addLog) insA.run(e.sid, e.ip, e.at);
    opened.exec("DELETE FROM reports");
    const insR = opened.prepare("INSERT INTO reports VALUES (?, ?, ?)");
    for (const r of store.reports) insR.run(r.mint, r.sid, r.at);
    pruneKeys(opened, "provenance", "mint", Object.keys(store.provenance));
    const insP = opened.prepare("INSERT OR REPLACE INTO provenance VALUES (?, ?, ?, ?)");
    for (const [mint, p] of Object.entries(store.provenance)) {
      insP.run(mint, p.creator, p.status, p.at);
    }
    pruneKeys(opened, "moderation", "id", store.moderation.map((m) => m.id));
    const insM = opened.prepare("INSERT OR REPLACE INTO moderation VALUES (?, ?, ?, ?, ?)");
    for (const m of store.moderation) {
      insM.run(m.id, m.mint, m.projectId, m.status, m.createdAt);
    }
    opened.prepare("INSERT OR REPLACE INTO coin_snapshot VALUES (1, ?, ?)").run(
      JSON.stringify(store.coinSnapshot?.coins || []),
      store.coinSnapshot?.at || 0,
    );
    opened.prepare("INSERT OR REPLACE INTO extra VALUES (1, ?)").run(
      JSON.stringify({
        dex: store.dex || {},
        scanCursor: store.scanCursor || emptyExtra().scanCursor,
        rankSnapshot: store.rankSnapshot || emptyExtra().rankSnapshot,
        tape: store.tape || [],
        rankHistory: store.rankHistory || [],
        seenMints: store.seenMints || [],
        mintStatus: store.mintStatus || {},
        boostSeen: store.boostSeen || {},
        dossiers: store.dossiers || {},
        indexDays: store.indexDays || [],
        burnLedger: (store.burnLedger || []).slice(0, 300),
        burnHits: pruneBurnHits(store.burnHits || {}),
        mintBurnIndex: store.mintBurnIndex || emptyExtra().mintBurnIndex,
        attributedBurns: store.attributedBurns || {},
        projectBurns: store.projectBurns || {},
        flagsIssued: parseFlagLedger(store.flagsIssued),
        webhookAt: store.webhookAt || null,
      }),
    );
    pruneKeys(opened, "watches", "key", Object.keys(store.watches || {}));
    const insW = opened.prepare("INSERT OR REPLACE INTO watches VALUES (?, ?)");
    for (const [key, mints] of Object.entries(store.watches || {})) {
      insW.run(key, JSON.stringify(mints));
    }
    opened.prepare("INSERT OR REPLACE INTO meta VALUES (1, ?)").run(store.rev || 0);
    opened.exec("COMMIT");
  } catch (e) {
    opened.exec("ROLLBACK");
    throw e;
  }
}

function remoteConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.STORE_SECRET);
}

function mergeStore(raw: unknown): Store {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<Store>;
  return {
    ...base,
    ...s,
    coinSnapshot: s.coinSnapshot || base.coinSnapshot,
    dex: s.dex || base.dex,
    scanCursor: s.scanCursor || base.scanCursor,
    rankSnapshot: s.rankSnapshot || base.rankSnapshot,
    tape: s.tape || base.tape,
    rankHistory: s.rankHistory || base.rankHistory,
    seenMints: s.seenMints || base.seenMints,
    mintStatus: s.mintStatus || base.mintStatus,
    boostSeen: s.boostSeen || base.boostSeen,
    watches: s.watches || base.watches,
    dossiers: s.dossiers || base.dossiers,
    indexDays: s.indexDays || base.indexDays,
    burnLedger: s.burnLedger || base.burnLedger,
    burnHits: seedBurnHits(parseBurnHits(s.burnHits), s.burnLedger),
    mintBurnIndex: parseMintBurnIndex(s.mintBurnIndex),
    attributedBurns: s.attributedBurns || base.attributedBurns,
    projectBurns: s.projectBurns || base.projectBurns,
    flagsIssued: parseFlagLedger(s.flagsIssued),
    webhookAt: s.webhookAt ?? base.webhookAt,
    rev: Number(s.rev) || 0,
  };
}

async function remoteLoad(): Promise<Store | null> {
  if (!remoteConfigured()) return null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/crosscheck_dump`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY!,
        authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_secret: process.env.STORE_SECRET }),
    });
    if (!res.ok) return null;
    return mergeStore(await res.json());
  } catch {
    return null;
  }
}

async function remoteSave(store: Store): Promise<"ok" | "stale" | "fail"> {
  if (!remoteConfigured()) return "ok";
  try {
    const payload: Store = slimRemoteStore({
      ...store,
      holders: Object.fromEntries(
        Object.entries(store.holders || {}).map(([mint, h]) => [mint, { ...h, holders: (h.holders || []).slice(0, 12) }]),
      ),
      dossiers: Object.fromEntries(
        Object.entries(store.dossiers || {}).map(([mint, d]) => [mint, { ...d, holders: (d.holders || []).slice(0, 12) }]),
      ),
    });
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/crosscheck_save`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY!,
        authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_secret: process.env.STORE_SECRET, p_payload: payload }),
    });
    if (res.ok) return "ok";
    const text = await res.text();
    if (/stale/i.test(text)) return "stale";
    console.error("store persist failed", res.status);
    return "fail";
  } catch (err) {
    console.error("store persist failed", err instanceof Error ? err.message : "network");
    return "fail";
  }
}

function rememberRead(store: Store) {
  g.__crosscheckStoreRead = { at: Date.now(), value: structuredClone(store) };
}

async function loadCurrent(): Promise<{ store: Store; durable: boolean }> {
  if (remoteConfigured()) {
    const remote = await remoteLoad();
    if (remote) return { store: remote, durable: true };
    const stale = g.__crosscheckStoreRead?.value;
    if (stale) return { store: structuredClone(stale), durable: false };
    if (process.env.VERCEL) return { store: empty(), durable: false };
  }
  const opened = getDb();
  if (!opened) return { store: empty(), durable: false };
  try {
    return { store: load(opened), durable: true };
  } catch {
    return { store: empty(), durable: false };
  }
}

async function persistCurrent(store: Store): Promise<"ok" | "stale" | "fail"> {
  const opened = process.env.VERCEL && remoteConfigured() ? null : getDb();
  if (opened) {
    try {
      persist(opened, store);
    } catch {
      /* sqlite busy or unwritable */
    }
  }
  if (remoteConfigured()) return remoteSave(store);
  return "ok";
}

export function withStore<T>(
  fn: (store: Store) => Promise<T> | T,
  opts?: { persist?: boolean },
): Promise<T> {
  const shouldPersist = opts?.persist !== false;
  const run = queue.then(async () => {
    let last: T | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { store, durable } = await loadCurrent();
      last = await fn(store);
      if (!shouldPersist || !durable) {
        rememberRead(store);
        return last;
      }
      store.rev = (Number(store.rev) || 0) + 1;
      const saved = await persistCurrent(store);
      if (saved !== "stale") {
        rememberRead(store);
        return last;
      }
    }
    if (last !== undefined) return last;
    throw new Error("Couldn't save the board.");
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  g.__crosscheckQueue = queue;
  return run;
}

export function readStore() {
  const hit = g.__crosscheckStoreRead;
  if (hit && Date.now() - hit.at < STORE_READ_MS) {
    return Promise.resolve(hit.value);
  }
  return withStore(async (s) => {
    rememberRead(s);
    return g.__crosscheckStoreRead!.value;
  }, { persist: false });
}
