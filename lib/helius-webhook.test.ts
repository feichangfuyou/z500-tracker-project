import { describe, expect, it } from "vitest";
import { ANSEM_MINT } from "./types";
import {
  ansemBurnsFromWebhook,
  burnWalletFromTx,
  heliusWebhookTransactions,
  trackedMintFromTx,
  webhookAuthorized,
  webhookHitTime,
} from "./helius-webhook";

describe("heliusWebhookTransactions", () => {
  it("accepts a raw array or wrapped body", () => {
    expect(heliusWebhookTransactions([{ signature: "a" }])).toHaveLength(1);
    expect(heliusWebhookTransactions({ transactions: [{ signature: "b" }] })).toHaveLength(1);
    expect(heliusWebhookTransactions({ body: [{ signature: "c" }] })).toHaveLength(1);
    expect(heliusWebhookTransactions({ nope: true })).toEqual([]);
  });
});

describe("ansemBurnsFromWebhook", () => {
  it("keeps $ANSEM burns with a from wallet", () => {
    const hits = ansemBurnsFromWebhook(
      [
        {
          signature: "s1",
          type: "BURN",
          timestamp: 1_700_000_000,
          tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 12, fromUserAccount: "w1" }],
        },
        {
          signature: "s2",
          type: "BURN",
          tokenTransfers: [{ mint: "other", tokenAmount: 99, fromUserAccount: "w2" }],
        },
        {
          signature: "s1",
          type: "BURN",
          tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 12, fromUserAccount: "w1" }],
        },
      ],
      ANSEM_MINT,
      9,
    );
    expect(hits).toEqual([{ signature: "s1", wallet: "w1", amount: 12, at: 1_700_000_000_000 }]);
  });

  it("attributes a burn to a tracked mint when the tx names it", () => {
    const tracked = new Set(["CoinMint11111111111111111111111111111111111"]);
    expect(
      trackedMintFromTx(
        {
          description: "Burned ANSEM for CoinMint11111111111111111111111111111111111",
          tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 1, fromUserAccount: "w" }],
        },
        tracked,
      ),
    ).toBe("CoinMint11111111111111111111111111111111111");
    const hits = ansemBurnsFromWebhook(
      [
        {
          signature: "s3",
          type: "BURN",
          description: "CoinMint11111111111111111111111111111111111",
          tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 3, fromUserAccount: "w9" }],
        },
      ],
      ANSEM_MINT,
      9,
      tracked,
    );
    expect(hits[0]?.mint).toBe("CoinMint11111111111111111111111111111111111");
    expect(hits[0]?.via).toBe("mint");
  });

  it("attributes a burn from a memo slug when the mint is not in the tx", () => {
    const tracked = new Set(["m1"]);
    const hits = ansemBurnsFromWebhook(
      [
        {
          signature: "memo1",
          type: "BURN",
          tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 8, fromUserAccount: "wx" }],
          instructions: [{ programId: "MemoSq4gqJC8NFXTxj6x7YhhVJXcmsuA", data: "frog" }],
        },
      ],
      ANSEM_MINT,
      9,
      tracked,
      [{ mint: "m1", slug: "frog", ticker: "FROG", name: "Frog" }],
    );
    expect(hits[0]).toMatchObject({ mint: "m1", via: "memo", amount: 8 });
  });

  it("falls back to fee payer when transfers omit the owner", () => {
    expect(
      burnWalletFromTx({
        type: "BURN",
        feePayer: "payer",
        tokenTransfers: [{ mint: ANSEM_MINT, tokenAmount: 1 }],
      }),
    ).toBe("payer");
    expect(webhookHitTime({ timestamp: 50 }, 9)).toBe(50_000);
  });
});

describe("webhookAuthorized", () => {
  it("accepts bearer, raw header, or query secret", () => {
    const prev = process.env.HELIUS_WEBHOOK_SECRET;
    process.env.HELIUS_WEBHOOK_SECRET = "hook-secret";
    try {
      expect(
        webhookAuthorized(
          new Request("http://localhost/api/webhooks/helius", { headers: { authorization: "Bearer hook-secret" } }),
        ),
      ).toBe(true);
      expect(
        webhookAuthorized(new Request("http://localhost/api/webhooks/helius", { headers: { authorization: "hook-secret" } })),
      ).toBe(true);
      expect(webhookAuthorized(new Request("http://localhost/api/webhooks/helius?secret=hook-secret"))).toBe(true);
      expect(webhookAuthorized(new Request("http://localhost/api/webhooks/helius"))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.HELIUS_WEBHOOK_SECRET;
      else process.env.HELIUS_WEBHOOK_SECRET = prev;
    }
  });
});
