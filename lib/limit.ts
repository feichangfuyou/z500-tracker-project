import { NextResponse } from "next/server";
import { remoteTooMany } from "@/lib/remote";
import { clientIp } from "@/lib/session";

export const LIMITS = {
  rpc: { max: 20, windowMs: 60_000 },
  write: { max: 30, windowMs: 60_000 },
  auth: { max: 8, windowMs: 15 * 60_000 },
  read: { max: 90, windowMs: 60_000 },
} as const;

type Scope = keyof typeof LIMITS;

const g = globalThis as typeof globalThis & { __crosscheckLimit?: Map<string, number[]> };
const buckets = (g.__crosscheckLimit ??= new Map<string, number[]>());

export function tooMany(key: string, max: number, windowMs: number, now = Date.now()) {
  const hits = (buckets.get(key) || []).filter((at) => now - at < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}

export function resetLimits() {
  buckets.clear();
}

export async function limited(req: Request, scope: Scope) {
  const { max, windowMs } = LIMITS[scope];
  const ip = clientIp(req);
  const key = `${scope}:${ip}`;
  if (scope !== "read") {
    const remote = await remoteTooMany(key, max, windowMs);
    if (remote != null) return remote;
  }
  return tooMany(key, max, windowMs);
}

export function limitResponse(scope: Scope) {
  const seconds = Math.ceil(LIMITS[scope].windowMs / 1000);
  return NextResponse.json(
    { error: "Too many requests. Slow down and try again." },
    { status: 429, headers: { "retry-after": String(seconds) } },
  );
}
