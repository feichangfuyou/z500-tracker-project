import { afterEach, describe, expect, it, vi } from "vitest";
import { rpcEndpoints, rpcPostAny } from "./rpc";

describe("rpcEndpoints", () => {
  it("always includes public failover URLs", () => {
    const urls = rpcEndpoints();
    expect(urls.length).toBeGreaterThanOrEqual(2);
    expect(urls[0]).toMatch(/^https:\/\//);
  });
});

describe("rpcPostAny", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips a 429 endpoint and uses the next one", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n += 1;
      if (n === 1) return new Response("nope", { status: 429 });
      return new Response("{}", { status: 200 });
    });
    await expect(rpcPostAny({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] })).resolves.toEqual({});
  });

  it("skips a 200 JSON-RPC error and uses the next endpoint", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Request blocked" } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }), { status: 200 });
    });
    await expect(rpcPostAny({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] })).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: "ok",
    });
  });

  it("aborts hung endpoints and continues", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async (_url: string | URL, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      n += 1;
      if (n === 1) {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        throw err;
      }
      return new Response("{}", { status: 200 });
    });
    await expect(rpcPostAny({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] })).resolves.toEqual({});
  });
});
