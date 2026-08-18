import { describe, expect, it } from "vitest";
import { alertContext, parseAlertFilter, tapeForAlerts } from "./alert-filter";
import type { TapeEvent } from "./types";

const burn = (mint: string, id = mint): TapeEvent => ({
  id: `burn:${id}`,
  kind: "burn",
  at: 1,
  mint,
  name: mint,
  label: "burned",
});

describe("parseAlertFilter", () => {
  it("defaults to watch/radar and only all is the firehose", () => {
    expect(parseAlertFilter(undefined)).toBe("watch,radar");
    expect(parseAlertFilter("ALL")).toBe("all");
    expect(parseAlertFilter("watch")).toBe("watch,radar");
  });
});

describe("tapeForAlerts", () => {
  it("keeps watched and paid mints, drops free noise", () => {
    const ctx = alertContext({
      watches: { sid: ["watch1"] },
      coins: [
        { mint: "gold1", tier: "Gold" },
        { mint: "free1", tier: "Free" },
      ],
    });
    const events = [burn("watch1"), burn("gold1"), burn("free1")];
    expect(tapeForAlerts(events, ctx).map((e) => e.mint)).toEqual(["watch1", "gold1"]);
    expect(tapeForAlerts(events, ctx, "all")).toHaveLength(3);
  });
});
