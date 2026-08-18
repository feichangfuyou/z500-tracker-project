import { timingSafeEqual } from "node:crypto";

export const CDN_CACHE = {
  "cache-control": "public, s-maxage=20, stale-while-revalidate=60, stale-if-error=300",
  vary: "accept",
} as const;

export const CDN_CACHE_LONG = {
  "cache-control": "public, s-maxage=45, stale-while-revalidate=120, stale-if-error=300",
  vary: "accept",
} as const;

export const NO_STORE = {
  "cache-control": "private, no-store",
} as const;

const MAX_JSON = 16 * 1024;

export function cookieBase(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
  };
}

export function secretEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const len = Math.max(a.length, b.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  return timingSafeEqual(pa, pb) && a.length === b.length;
}

export async function readJson<T>(
  req: Request,
  maxBytes = MAX_JSON,
): Promise<{ ok: true; value: T } | { ok: false; status: number; error: string }> {
  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: "Payload too large." };
  }
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, status: 413, error: "Payload too large." };
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}
