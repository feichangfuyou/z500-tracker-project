import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { cookieBase, secretEquals } from "@/lib/http";

const COOKIE = "crosscheck_mod";

export function modKey() {
  if (process.env.MOD_KEY) return process.env.MOD_KEY;
  if (process.env.VERCEL) return "";
  return "dev-mod";
}

function modToken() {
  const key = modKey();
  if (!key) return "";
  return createHmac("sha256", key).update("crosscheck-mod-v1").digest("hex");
}

export async function isMod() {
  const jar = await cookies();
  const expected = modToken();
  if (!expected) return false;
  const got = jar.get(COOKIE)?.value || "";
  return secretEquals(got, expected);
}

export async function setModCookie() {
  const jar = await cookies();
  const token = modToken();
  if (!token) return;
  jar.set(COOKIE, token, cookieBase(60 * 60 * 24 * 30));
}
