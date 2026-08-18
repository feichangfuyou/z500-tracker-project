import { afterEach, describe, expect, it, vi } from "vitest";
import { ANSEM_MINT } from "./types";
import {
  PUMP_PROGRAM,
  burnsInTx,
  concentrationFromHolderPcts,
  extractMintCreatorFromTx,
  fetchHolderConcentration,
  holdersFromLargestAccounts,
  mapTokenAccounts,
} from "./solana";

describe("burnsInTx", () => {
  it("sums parsed ANSEM burns including inner instructions", () => {
    const tx = {
      transaction: {
        message: {
          instructions: [
            {
              parsed: {
                type: "burnChecked",
                info: { mint: ANSEM_MINT, tokenAmount: { uiAmount: 12 } },
              },
            },
          ],
        },
      },
      meta: {
        innerInstructions: [
          {
            instructions: [
              {
                parsed: { type: "burn", info: { mint: ANSEM_MINT, amount: "1000000" } },
              },
            ],
          },
        ],
      },
    };
    expect(burnsInTx(tx)).toBe(13);
  });
});

describe("extractMintCreatorFromTx", () => {
  const mint = "Mint111111111111111111111111111111111111111";
  const creator = "Creator11111111111111111111111111111111111";

  it("prefers the pump.fun create user account", () => {
    expect(
      extractMintCreatorFromTx(
        {
          transaction: {
            message: {
              accountKeys: ["FeePayer111111111111111111111111111111111"],
              instructions: [
                {
                  programId: PUMP_PROGRAM,
                  accounts: [
                    mint,
                    "mintAuth",
                    "curve",
                    "assoc",
                    "global",
                    "mpl",
                    "meta",
                    creator,
                    "system",
                  ],
                },
              ],
            },
          },
        },
        mint,
      ),
    ).toBe(creator);
  });

  it("falls back to initializeMint authority", () => {
    expect(
      extractMintCreatorFromTx(
        {
          transaction: {
            message: {
              accountKeys: ["FeePayer111111111111111111111111111111111"],
              instructions: [
                {
                  parsed: { type: "initializeMint2", info: { mint, mintAuthority: creator } },
                },
              ],
            },
          },
        },
        mint,
      ),
    ).toBe(creator);
  });
});

describe("concentrationFromHolderPcts", () => {
  it("converts RugCheck 0-100 percents into a 0-1 share", () => {
    expect(concentrationFromHolderPcts([40, 20, 10])).toBeCloseTo(0.7);
  });

  it("returns null when there is no holder share", () => {
    expect(concentrationFromHolderPcts([])).toBeNull();
  });
});

describe("holdersFromLargestAccounts", () => {
  it("turns RPC largest accounts into percent rows", () => {
    expect(
      holdersFromLargestAccounts(
        [
          { address: "A".repeat(32), uiAmount: 40 },
          { address: "B".repeat(32), uiAmount: 10 },
        ],
        100,
      ),
    ).toEqual([
      { address: "A".repeat(32), owner: null, pct: 40, insider: false },
      { address: "B".repeat(32), owner: null, pct: 10, insider: false },
    ]);
  });
});

describe("fetchHolderConcentration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses RugCheck when public RPCs cannot serve largest-accounts", async () => {
    const prev = process.env.SOLANA_RPC;
    delete process.env.SOLANA_RPC;
    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("rugcheck.xyz")) {
        return new Response(JSON.stringify({ topHolders: [{ pct: 40 }, { pct: 20 }, { pct: 10 }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("rate limited", { status: 429 });
    });
    try {
      await expect(fetchHolderConcentration("HxQhDGYqyjorgogMJx7YbBHADEDxuHhLnMMmr6VYpyn")).resolves.toBeCloseTo(0.7);
    } finally {
      if (prev === undefined) delete process.env.SOLANA_RPC;
      else process.env.SOLANA_RPC = prev;
    }
  });
});

describe("mapTokenAccounts", () => {
  it("keeps empty accounts so sold vs unclaimed can be split", () => {
    expect(
      mapTokenAccounts([
        { account: { data: { parsed: { info: { mint: "a", tokenAmount: { uiAmount: 4 } } } } } },
        { account: { data: { parsed: { info: { mint: "b", tokenAmount: { uiAmount: 0 } } } } } },
        { account: { data: { parsed: { info: { mint: "c", tokenAmount: { uiAmount: null } } } } } },
      ]),
    ).toEqual([
      { mint: "a", amount: 4 },
      { mint: "b", amount: 0 },
      { mint: "c", amount: 0 },
    ]);
  });
});
