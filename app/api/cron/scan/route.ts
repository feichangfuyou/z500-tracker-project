import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { remoteLog } from "@/lib/remote";
import { runScanPass } from "@/lib/scan-pass";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runScanPass();
    return NextResponse.json(result);
  } catch (err) {
    console.error("cron scan failed", err);
    await remoteLog("cron scan failed", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Scan pass failed." }, { status: 502 });
  }
}
