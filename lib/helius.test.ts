import { afterEach, describe, expect, it, vi } from "vitest";
import { ANSEM_MINT } from "./types";
import {
  ansemBurnInHeliusTx,
  burnIndexMode,
  heliusApiKey,
  heliusHistoryUrl,
  heliusPageBudget,
  heliusPageDone,
  heliusRpcUrl,
  indexHeliusBurns,
  isTransferCursor,
  sumHeliusBurns,
  takeUntilSig,
} from "./helius";

describe("helius helpers", () => {
  it("reads an api-key from a Helius RPC URL", () => {
    expect(heliusApiKey("https://mainnet.helius-rpc.com/?api-key=abc", "")).toBe("abc");
    expect(heliusRpcUrl("https://mainnet.helius-rpc.com/?api-key=abc", "")).toBe(
      "https://mainnet.helius-rpc.com/?api-key=abc",
    );
    expect(isTransferCursor("12:1:0:splTransfer")).toBe(true);
  });

  it("sums ANSEM burns and ignores other mints", () => {
    const txs = [
      { signature: "s1", type: "BURN", tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 12 }] },
      { signature: "s2", tokenTransfers: [{ mint: "other", tokenAmount: 99, toUserAccount: null }] },
    ];
    expect(ansemBurnInHeliusTx(txs[0]!)).toBe(12);
    expect(sumHeliusBurns(txs).verifiedBurn).toBe(12);
    expect(sumHeliusBurns(txs).txBurned).toBe(1);
  });

  it("counts Token-2022 UNKNOWN burns from negative balance changes", () => {
    const tx = {
      type: "UNKNOWN",
      accountData: [
        {
          tokenBalanceChanges: [
            { mint: ANSEM_MINT, rawTokenAmount: { tokenAmount: "-277861000000", decimals: 6 } },
          ],
        },
      ],
    };
    expect(ansemBurnInHeliusTx(tx)).toBe(277861);
  });

  it("does not double-count a BURN transfer plus the matching balance change", () => {
    const tx = {
      type: "BURN",
      tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 12 }],
      accountData: [
        {
          tokenBalanceChanges: [
            { mint: ANSEM_MINT, rawTokenAmount: { tokenAmount: "-12000000", decimals: 6 } },
          ],
        },
      ],
    };
    expect(ansemBurnInHeliusTx(tx)).toBe(12);
  });

  it("keeps a multi-million UI burn instead of treating it as raw units", () => {
    expect(ansemBurnInHeliusTx({ type: "BURN", tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 2_000_000 }] })).toBe(
      2_000_000,
    );
  });
});

describe("burnIndexMode", () => {
  it("resumes older pages instead of restarting a live cursor", () => {
    expect(burnIndexMode({})).toBe("fresh");
    expect(burnIndexMode({ headSig: "h" })).toBe("head");
    expect(burnIndexMode({ cursor: "c", continueOlder: true })).toBe("older");
    expect(burnIndexMode({ cursor: "c", headSig: "h", continueOlder: true })).toBe("older");
    expect(burnIndexMode({ cursor: "c", reindex: true })).toBe("fresh");
    expect(burnIndexMode({ cursor: "c", headSig: "h" })).toBe("head");
    expect(burnIndexMode({ cursor: "c" })).toBe("older");
  });

  it("sizes page budgets by mode", () => {
    expect(heliusPageBudget("fresh")).toBeGreaterThan(heliusPageBudget("head"));
    expect(heliusPageBudget("older")).toBeGreaterThan(heliusPageBudget("head"));
  });
});

describe("takeUntilSig", () => {
  it("keeps only txs newer than the known head", () => {
    const batch = [{ signature: "n1" }, { signature: "n2" }, { signature: "h" }, { signature: "old" }];
    expect(takeUntilSig(batch, "h")).toEqual({
      txs: [{ signature: "n1" }, { signature: "n2" }],
      hitUntil: true,
    });
    expect(heliusPageDone(100, true)).toBe(true);
    expect(heliusPageDone(100, false)).toBe(false);
    expect(heliusPageDone(40, false)).toBe(true);
  });
});

describe("heliusHistoryUrl", () => {
  it("pages newest-first with before/until", () => {
    const url = heliusHistoryUrl("Wallet1", "k", { before: "b", until: "u" });
    expect(url.searchParams.get("before")).toBe("b");
    expect(url.searchParams.get("until")).toBe("u");
    expect(url.searchParams.get("type")).toBeNull();
    expect(url.pathname).toContain("/addresses/Wallet1/transactions");
  });
});

describe("indexHeliusBurns", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pages a fresh wallet and stays open when the last page is full", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({
      signature: `s${i}`,
      type: "BURN",
      tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 1 }],
    }));
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify(full), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
    const result = await indexHeliusBurns("Wallet1", {
      mode: "fresh",
      key: "k",
      maxPages: 2,
      deadline: Date.now() + 10_000,
    });
    expect(result?.verifiedBurn).toBe(200);
    expect(result?.exhausted).toBe(false);
    expect(result?.headSig).toBe("s0");
    expect(result?.cursor).toBe("s99");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("before=s99");
  });

  it("adds only head txs until the known signature", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { signature: "new", type: "BURN", tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 5 }] },
            { signature: "head", type: "BURN", tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 9 }] },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const result = await indexHeliusBurns("Wallet1", {
      mode: "head",
      headSig: "head",
      cursor: "old",
      key: "k",
      maxPages: 2,
      deadline: Date.now() + 10_000,
    });
    expect(result?.verifiedBurn).toBe(5);
    expect(result?.headSig).toBe("new");
    expect(result?.cursor).toBe("old");
    expect(result?.exhausted).toBe(true);
  });

  it("treats a Helius 404 as an empty burn history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Failed to find events" }), { status: 404 })),
    );
    const result = await indexHeliusBurns("Wallet1", {
      mode: "fresh",
      key: "k",
      maxPages: 2,
      deadline: Date.now() + 10_000,
    });
    expect(result?.verifiedBurn).toBe(0);
    expect(result?.exhausted).toBe(true);
    expect(result?.txChecked).toBe(0);
  });
});
