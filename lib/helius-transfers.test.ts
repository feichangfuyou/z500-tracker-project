import { afterEach, describe, expect, it, vi } from "vitest";
import { ANSEM_MINT } from "./types";
import {
  ansemBurnInTransfer,
  indexTransferBurns,
  isAnsemBurnTransfer,
  resetTransferApiState,
  sumTransferBurns,
} from "./helius-transfers";
import { isTransferCursor } from "./helius";

function rpcOk(data: unknown[], paginationToken: string | null = null) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: "cc-transfers", result: { data, paginationToken } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("transfer burn helpers", () => {
  it("recognizes Helius transfer pagination tokens", () => {
    expect(isTransferCursor("315073428:35:1:0:splTransfer")).toBe(true);
    expect(isTransferCursor("5h6xBEauJ3PK6SWCZ1PGjBvj8vDdWG3KpwATGy1ARAXFSDwt8GFXM7W5Ncn16wmqokgpiKRLuS83KUxyZyv2sUYv")).toBe(
      false,
    );
  });

  it("counts typed ANSEM burns from uiAmount", () => {
    expect(
      ansemBurnInTransfer({
        type: "burn",
        mint: ANSEM_MINT,
        uiAmount: "370508",
        toUserAccount: null,
        fromUserAccount: "Wallet1",
      }),
    ).toBe(370508);
    expect(isAnsemBurnTransfer({ type: "transfer", mint: ANSEM_MINT, uiAmount: "9", toUserAccount: "other" })).toBe(false);
    expect(sumTransferBurns([{ type: "burn", mint: "other", uiAmount: "99", toUserAccount: null }]).verifiedBurn).toBe(0);
  });

  it("falls back to raw amount when uiAmount is missing", () => {
    expect(
      ansemBurnInTransfer({
        type: "burn",
        mint: ANSEM_MINT,
        amount: "12000000",
        decimals: 6,
        toUserAccount: null,
      }),
    ).toBe(12);
  });
});

describe("indexTransferBurns", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetTransferApiState();
    delete process.env.SOLANA_RPC;
  });

  it("pages mint-filtered burns and replaces an Enhanced cursor", async () => {
    process.env.SOLANA_RPC = "https://mainnet.helius-rpc.com/?api-key=test";
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body || "{}")));
        return rpcOk(
          [
            {
              signature: "b1",
              type: "burn",
              mint: ANSEM_MINT,
              uiAmount: "100",
              toUserAccount: null,
              fromUserAccount: "Wallet1",
            },
            {
              signature: "t1",
              type: "transfer",
              mint: ANSEM_MINT,
              uiAmount: "50",
              toUserAccount: "other",
              fromUserAccount: "Wallet1",
            },
          ],
          null,
        );
      }),
    );
    const result = await indexTransferBurns("Wallet1", {
      mode: "older",
      cursor: "enhancedSigNotAToken",
      maxPages: 2,
      deadline: Date.now() + 10_000,
    });
    expect(result && "unavailable" in result).toBe(false);
    if (!result || "unavailable" in result) return;
    expect(result.verifiedBurn).toBe(100);
    expect(result.txBurned).toBe(1);
    expect(result.txChecked).toBe(2);
    expect(result.exhausted).toBe(true);
    expect(result.replace).toBe(true);
    expect(result.cursor).toBeNull();
    expect(result.headSig).toBe("b1");
    const req = bodies[0] as { method: string; params: [string, { mint: string; paginationToken?: string }] };
    expect(req.method).toBe("getTransfersByAddress");
    expect(req.params[1].mint).toBe(ANSEM_MINT);
    expect(req.params[1].paginationToken).toBeUndefined();
  });

  it("resumes from a transfer pagination token without replacing", async () => {
    process.env.SOLANA_RPC = "https://mainnet.helius-rpc.com/?api-key=test";
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body || "{}")));
        return rpcOk(
          [
            {
              signature: "b2",
              type: "burn",
              mint: ANSEM_MINT,
              uiAmount: "7",
              toUserAccount: null,
            },
          ],
          null,
        );
      }),
    );
    const result = await indexTransferBurns("Wallet1", {
      mode: "older",
      cursor: "315073428:35:1:0:splTransfer",
      headSig: "head",
      maxPages: 2,
      deadline: Date.now() + 10_000,
    });
    expect(result && "unavailable" in result).toBe(false);
    if (!result || "unavailable" in result) return;
    expect(result.verifiedBurn).toBe(7);
    expect(result.replace).toBe(false);
    expect(result.headSig).toBe("head");
    const req = bodies[0] as { params: [string, { paginationToken?: string }] };
    expect(req.params[1].paginationToken).toBe("315073428:35:1:0:splTransfer");
  });

  it("marks Developer-only errors as unavailable", async () => {
    process.env.SOLANA_RPC = "https://mainnet.helius-rpc.com/?api-key=test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: "cc-transfers", error: { code: -32601, message: "Method not found" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const result = await indexTransferBurns("Wallet1", {
      mode: "fresh",
      maxPages: 1,
      deadline: Date.now() + 10_000,
    });
    expect(result).toEqual({ unavailable: true });
  });
});
