import { describe, expect, it } from "vitest";
import { formatTapeLine, formatTapeMessage, closedTabHint, notifyChannels } from "./notify";
import type { TapeEvent } from "./types";

const launch: TapeEvent = {
  id: "launch:m:1",
  kind: "launch",
  at: 1,
  mint: "m",
  name: "Frog",
  ticker: "FROG",
  slug: "frog",
  label: "$FROG just launched on ansem.io",
};

describe("formatTapeMessage", () => {
  it("puts the official coin URL under a launch", () => {
    const line = formatTapeLine(launch);
    expect(line).toContain("Open on ansem.io");
    expect(line).toContain("https://ansem.io/coin/frog");
  });

  it("uses burn/boost verbs and skips URL when there is no slug", () => {
    expect(formatTapeLine({ ...launch, kind: "burn", slug: "frog", label: "burned" })).toContain("Burn on ansem.io");
    expect(formatTapeLine({ ...launch, kind: "boost", slug: "frog", label: "boost" })).toContain("Boost on ansem.io");
    expect(formatTapeLine({ ...launch, slug: undefined })).toBe(launch.label);
  });

  it("prefixes unofficial", () => {
    expect(formatTapeMessage([launch]).startsWith("Crosscheck · unofficial")).toBe(true);
  });
});

describe("notifyChannels", () => {
  it("reports which closed-tab channels are armed", () => {
    const prev = {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chat: process.env.TELEGRAM_CHAT_ID,
      discord: process.env.DISCORD_WEBHOOK_URL,
    };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.DISCORD_WEBHOOK_URL;
    expect(notifyChannels()).toEqual({ telegram: false, discord: false });
    expect(closedTabHint()).toBe("Closed-tab alerts unset");
    process.env.TELEGRAM_BOT_TOKEN = "t";
    process.env.TELEGRAM_CHAT_ID = "1";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.test";
    expect(notifyChannels()).toEqual({ telegram: true, discord: true });
    expect(closedTabHint()).toBe("Closed-tab: Telegram + Discord");
    if (prev.token === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = prev.token;
    if (prev.chat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = prev.chat;
    if (prev.discord === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = prev.discord;
  });
});
