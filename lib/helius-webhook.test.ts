import { describe, expect, it } from "vitest";
import { ANSEM_MINT } from "./types";
import {
  ansemBurnsFromWebhook,
  burnWalletFromTx,
  heliusWebhookTransactions,
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
