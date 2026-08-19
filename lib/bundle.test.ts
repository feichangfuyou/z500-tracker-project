import { describe, expect, it } from "vitest";
import { bundleFromWindow } from "./bundle";

describe("bundleFromWindow", () => {
  it("flags three wallets buying in the create slot", () => {
    const hit = bundleFromWindow(10, [
      { slot: 10, feePayer: "creator", pumpIxs: 1 },
      { slot: 10, feePayer: "snipe1", pumpIxs: 1 },
      { slot: 10, feePayer: "snipe2", pumpIxs: 1 },
      { slot: 11, feePayer: "later", pumpIxs: 1 },
    ]);
    expect(hit.sameBlockWallets).toBe(3);
    expect(hit.sameBlockBuyers).toEqual(["creator", "snipe1", "snipe2"]);
    expect(hit.sniper).toBe(true);
  });

  it("flags a create tx that also buys", () => {
    const hit = bundleFromWindow(5, [{ slot: 5, feePayer: "creator", pumpIxs: 2 }]);
    expect(hit.sniper).toBe(true);
  });

  it("leaves a clean create alone", () => {
    expect(bundleFromWindow(5, [{ slot: 5, feePayer: "creator", pumpIxs: 1 }]).sniper).toBe(false);
  });
});
