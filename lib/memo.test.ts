import { describe, expect, it } from "vitest";
import { decodeBase58, encodeBase58, decodeMemoData, memoTextsFromTx, MEMO_PROGRAM } from "./memo";

describe("base58 memo", () => {
  it("round-trips utf8 memo bytes", () => {
    const text = "burn for frog";
    const encoded = encodeBase58(new TextEncoder().encode(text));
    expect(new TextDecoder().decode(decodeBase58(encoded)!)).toBe(text);
    expect(decodeMemoData(encoded)).toBe(text);
  });

  it("keeps already-printable instruction data", () => {
    expect(decodeMemoData("eye")).toBe("eye");
  });
});

describe("memoTextsFromTx", () => {
  it("reads nested memo instructions", () => {
    const encoded = encodeBase58(new TextEncoder().encode("frog"));
    expect(
      memoTextsFromTx({
        instructions: [
          {
            programId: "other",
            innerInstructions: [{ programId: MEMO_PROGRAM, data: encoded }],
          },
        ],
      }),
    ).toEqual(["frog"]);
  });
});
