import { describe, expect, it } from "vitest";
import { buildIndexDay, overlayLiveIndex, pushIndexDay, utcDayLabel, utcDayStart } from "./index-day";

describe("daily index", () => {
  it("keeps the top 25 by score and replaces the same UTC day", () => {
    const coins = Array.from({ length: 30 }, (_, i) => ({
      mint: `m${i}`,
      name: `C${i}`,
      score: 30 - i,
      officialRank: i + 1,
      airdropMcap: 1,
      burned: 0,
    }));
    const day = buildIndexDay(coins, Date.parse("2026-08-18T15:00:00Z"));
    expect(day.at).toBe(utcDayStart(Date.parse("2026-08-18T15:00:00Z")));
    expect(day.coins).toHaveLength(25);
    expect(day.coins[0]?.mint).toBe("m0");
    expect(utcDayLabel(day.at)).toBe("2026-08-18");
    const next = buildIndexDay(coins.slice(0, 3), Date.parse("2026-08-18T20:00:00Z"));
    const hist = pushIndexDay([day], next);
    expect(hist).toHaveLength(1);
    expect(hist[0]?.coins).toHaveLength(3);
  });

  it("copies live dossier fields onto snapshot coins", () => {
    const day = buildIndexDay(
      [
        {
          mint: "a",
          name: "Alpha",
          ticker: "A",
          score: 9,
          officialRank: 2,
          airdropMcap: 400,
          burned: 12,
          imageUrl: "https://img/a.png",
          marketCap: 900,
          change24h: -3.5,
          tier: "Free",
          status: "migrated",
        },
      ],
      Date.parse("2026-08-18T15:00:00Z"),
    );
    expect(day.coins[0]).toMatchObject({
      marketCap: 900,
      change24h: -3.5,
      status: "migrated",
      imageUrl: "https://img/a.png",
    });
  });

  it("overlays today's live market fields onto a stored snapshot", () => {
    const at = Date.parse("2026-08-18T15:00:00Z");
    const snap = buildIndexDay(
      [{ mint: "a", name: "Alpha", score: 5, officialRank: 4, airdropMcap: 100, burned: 1 }],
      at,
    );
    const live = buildIndexDay(
      [
        {
          mint: "a",
          name: "Alpha",
          score: 8,
          officialRank: 3,
          airdropMcap: 200,
          burned: 2,
          marketCap: 700,
          change24h: 4.2,
          imageUrl: "https://img/a.png",
          flags: [{ id: "mismatch", label: "Wallet mismatch", severity: "bad" }],
        },
      ],
      at,
    );
    const out = overlayLiveIndex(snap, live);
    expect(out.coins[0]?.score).toBe(5);
    expect(out.coins[0]?.officialRank).toBe(4);
    expect(out.coins[0]?.airdropMcap).toBe(100);
    expect(out.coins[0]?.marketCap).toBe(700);
    expect(out.coins[0]?.change24h).toBe(4.2);
    expect(out.coins[0]?.flags?.[0]?.id).toBe("mismatch");
  });

  it("does not overlay a different UTC day", () => {
    const snap = buildIndexDay(
      [{ mint: "a", name: "A", score: 1, officialRank: 1, airdropMcap: 1, burned: null }],
      Date.parse("2026-08-17T15:00:00Z"),
    );
    const live = buildIndexDay(
      [
        {
          mint: "a",
          name: "A",
          score: 1,
          officialRank: 1,
          airdropMcap: 1,
          burned: null,
          change24h: 9,
        },
      ],
      Date.parse("2026-08-18T15:00:00Z"),
    );
    expect(overlayLiveIndex(snap, live).coins[0]?.change24h).toBeUndefined();
  });
});
