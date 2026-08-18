import { NextResponse } from "next/server";
import { isMod } from "@/lib/mod-auth";
import { notifyChannels, notifyTape } from "@/lib/notify";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isMod())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(notifyChannels());
}

export async function POST() {
  if (!(await isMod())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const channels = notifyChannels();
  if (!channels.telegram && !channels.discord) {
    return NextResponse.json({ error: "No Telegram or Discord channel is set." }, { status: 400 });
  }
  await notifyTape([
    {
      id: `test:${Date.now()}`,
      kind: "launch",
      at: Date.now(),
      mint: "test",
      name: "Crosscheck",
      label: "Test alert from /mod",
    },
  ]);
  return NextResponse.json({ ok: true, ...channels });
}
