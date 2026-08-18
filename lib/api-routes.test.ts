import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "sid-test" }),
    set: () => undefined,
  }),
}));

vi.mock("@/lib/store", () => ({
  withStore: async (fn: (store: { burns: Record<string, never>; holders: Record<string, never>; watches?: Record<string, string[]>; dossiers?: Record<string, never>; provenance?: Record<string, never> }) => unknown) =>
    fn({ burns: {}, holders: {}, watches: {}, dossiers: {}, provenance: {} }),
}));

vi.mock("@/lib/ansem", () => ({
  fetchAnsemCoins: async () => [],
}));

import { POST as postVerify } from "../app/api/verify/route";
import { POST as postHolders } from "../app/api/holders/route";
import { POST as postProvenance } from "../app/api/provenance/route";
import { POST as postProjects } from "../app/api/projects/route";
import { POST as postModLogin } from "../app/api/mod/login/route";
import { POST as postAirdrop } from "../app/api/airdrop/route";
import { GET as getCron } from "../app/api/cron/scan/route";
import { PUT as putWatch } from "../app/api/watch/route";
import { GET as getAlerts, POST as postAlerts } from "../app/api/mod/alerts/route";
import { POST as postWebhook } from "../app/api/webhooks/helius/route";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API validation", () => {
  it("rejects a bad verify wallet", async () => {
    const res = await postVerify(jsonRequest("http://localhost/api/verify", { wallet: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects a bad holders mint", async () => {
    const res = await postHolders(jsonRequest("http://localhost/api/holders", { mint: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects a bad provenance mint", async () => {
    const res = await postProvenance(jsonRequest("http://localhost/api/provenance", { mint: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects a bad community mint", async () => {
    const res = await postProjects(jsonRequest("http://localhost/api/projects", { name: "x", mint: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects a bad mod key", async () => {
    const res = await postModLogin(jsonRequest("http://localhost/api/mod/login", { key: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("rejects a bad airdrop wallet", async () => {
    const res = await postAirdrop(jsonRequest("http://localhost/api/airdrop", { wallet: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects a bad watch wallet", async () => {
    const res = await putWatch(jsonRequest("http://localhost/api/watch", { mints: [], wallet: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated cron scan", async () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "s3cret";
    try {
      const res = await getCron(new Request("http://localhost/api/cron/scan"));
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  it("rejects an unauthenticated Helius webhook", async () => {
    const prev = process.env.HELIUS_WEBHOOK_SECRET;
    process.env.HELIUS_WEBHOOK_SECRET = "hook-secret";
    try {
      const res = await postWebhook(new Request("http://localhost/api/webhooks/helius", { method: "POST", body: "[]" }));
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.HELIUS_WEBHOOK_SECRET;
      else process.env.HELIUS_WEBHOOK_SECRET = prev;
    }
  });

  it("rejects unauthenticated alert status and test ping", async () => {
    expect((await getAlerts()).status).toBe(401);
    expect((await postAlerts()).status).toBe(401);
  });
});
