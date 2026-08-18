#!/usr/bin/env node
const base = process.env.BASE_URL || "http://localhost:3000";

async function req(path, opts = {}) {
  const res = await fetch(base + path, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log("ok ", name);
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message || e) });
    console.log("FAIL", name, e.message || e);
  }
}

await test("GET /", async () => {
  const r = await req("/");
  assert(r.status === 200, `status ${r.status}`);
  assert(r.text.includes("CROSSCHECK") || r.text.includes("Crosscheck"), "missing brand");
});

await test("GET /api/board", async () => {
  const r = await req("/api/board");
  assert(r.status === 200, `status ${r.status}`);
  assert(Array.isArray(r.json.projects), "no projects");
  assert(["ansem", "cache", "pump", "dex"].includes(r.json.feedSource), "bad feedSource");
  assert(typeof r.json.stats?.boosted === "number", "missing boosted stat");
  assert(Array.isArray(r.json.tape), "missing tape");
  const sample = r.json.projects[0];
  if (sample) {
    assert("officialRank" in sample || sample.score != null, "missing rank/score fields");
    assert(Array.isArray(sample.flags || []), "missing flags");
  }
});

await test("POST /api/projects invalid mint", async () => {
  const r = await req("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x", mint: "nope" }),
  });
  assert(r.status === 400, `status ${r.status}`);
});

await test("POST /api/verify invalid wallet", async () => {
  const r = await req("/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: "bad" }),
  });
  assert(r.status === 400, `status ${r.status}`);
});

await test("POST /api/holders invalid mint", async () => {
  const r = await req("/api/holders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mint: "bad" }),
  });
  assert(r.status === 400, `status ${r.status}`);
});

await test("GET /airdrop", async () => {
  const r = await req("/airdrop");
  assert(r.status === 200, `status ${r.status}`);
  assert(r.text.includes("Airdrop"), "missing airdrop copy");
});

await test("POST /api/airdrop invalid wallet", async () => {
  const r = await req("/api/airdrop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: "bad" }),
  });
  assert(r.status === 400, `status ${r.status}`);
});

await test("GET /c/:mint", async () => {
  const board = await req("/api/board");
  const mint = board.json?.projects?.[0]?.mint;
  if (!mint) return;
  const r = await req("/c/" + mint);
  assert(r.status === 200, `status ${r.status}`);
  assert(r.text.includes("Trade out") || r.text.includes("CROSSCHECK"), "missing coin page");
});

await test("GET /index", async () => {
  const r = await req("/index");
  assert(r.status === 200, `status ${r.status}`);
  assert(r.text.includes("Daily index") || r.text.includes("CROSSCHECK"), "missing index page");
});

await test("GET /wallets", async () => {
  const r = await req("/wallets");
  assert(r.status === 200, `status ${r.status}`);
  assert(r.text.includes("wallet") || r.text.includes("CROSSCHECK"), "missing wallets page");
});

await test("GET /api/public/board", async () => {
  const r = await req("/api/public/board");
  assert(r.status === 200, `status ${r.status}`);
  assert(Array.isArray(r.json.coins), "no public coins");
});

await test("PUT /api/watch invalid wallet", async () => {
  const r = await req("/api/watch", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mints: [], wallet: "bad" }),
  });
  assert(r.status === 400, `status ${r.status}`);
});

await test("GET /mod", async () => {
  const r = await req("/mod");
  assert(r.status === 200, `status ${r.status}`);
});

await test("GET /privacy", async () => {
  const r = await req("/privacy");
  assert(r.status === 200, `status ${r.status}`);
  assert(r.text.includes("Privacy") || r.text.includes("cookie"), "missing privacy copy");
});

await test("POST /api/mod/login bad key", async () => {
  const r = await req("/api/mod/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "wrong" }),
  });
  assert(r.status === 401, `status ${r.status}`);
});

await test("POST /api/mod/login good key", async () => {
  const key = process.env.MOD_KEY || "dev-mod";
  const r = await req("/api/mod/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });
  assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
});

await test("GET /api/cron/scan unauthorized", async () => {
  const r = await req("/api/cron/scan");
  assert(r.status === 401, `status ${r.status}`);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
