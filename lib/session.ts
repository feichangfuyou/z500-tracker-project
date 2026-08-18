import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { cookieBase } from "@/lib/http";

const COOKIE = "tracker_sid";
const COOKIE_OPTS = cookieBase(60 * 60 * 24 * 365);

export async function readSessionId() {
  try {
    const jar = await cookies();
    return jar.get(COOKIE)?.value || "";
  } catch {
    return "";
  }
}

export async function getSessionId() {
  try {
    const jar = await cookies();
    const existing = jar.get(COOKIE)?.value;
    if (existing) return existing;
    const sid = crypto.randomUUID();
    try {
      jar.set(COOKIE, sid, COOKIE_OPTS);
    } catch {
      /* GET handlers can reject cookies().set(); attachSessionCookie covers the response. */
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

export function attachSessionCookie<T>(res: NextResponse<T>, sid: string) {
  try {
    if (sid) res.cookies.set(COOKIE, sid, COOKIE_OPTS);
  } catch {
    /* ignore */
  }
  return res;
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
