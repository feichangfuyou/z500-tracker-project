import { ansemCoinUrl } from "./links";
import type { TapeEvent } from "./types";

function ctaFor(kind: TapeEvent["kind"]) {
  if (kind === "boost") return "Boost on ansem.io";
  if (kind === "burn") return "Burn on ansem.io";
  return "Open on ansem.io";
}

export function formatTapeLine(event: TapeEvent) {
  const url = ansemCoinUrl(event.slug);
  if (!url) return event.label;
  return `${event.label}\n${ctaFor(event.kind)}\n${url}`;
}

export function formatTapeMessage(events: TapeEvent[]) {
  const body = events.slice(0, 8).map(formatTapeLine).join("\n\n");
  return `Crosscheck · unofficial\n\n${body}`;
}

export function notifyChannels() {
  return {
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim()),
    discord: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
  };
}

export function closedTabHint(channels = notifyChannels()) {
  const parts = [
    channels.telegram ? "Telegram" : null,
    channels.discord ? "Discord" : null,
  ].filter((part): part is string => Boolean(part));
  if (!parts.length) return "Closed-tab alerts unset";
  return `Closed-tab: ${parts.join(" + ")}`;
}

async function telegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(4000),
  });
}

async function discord(text: string) {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: text.slice(0, 1800) }),
    signal: AbortSignal.timeout(4000),
  });
}

export async function notifyTape(events: TapeEvent[]) {
  if (!events.length) return;
  const text = formatTapeMessage(events);
  await Promise.allSettled([telegram(text), discord(text)]);
}
