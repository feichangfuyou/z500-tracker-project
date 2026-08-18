import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/http";
import { attachSessionCookie, getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const sid = await getSessionId();
    return attachSessionCookie(NextResponse.json({ sid }, { headers: NO_STORE }), sid);
  } catch {
    return NextResponse.json({ error: "Couldn't start a session." }, { status: 503 });
  }
}
