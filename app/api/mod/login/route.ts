import { NextResponse } from "next/server";
import { readJson, secretEquals } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { modKey, setModCookie } from "@/lib/mod-auth";

export async function POST(req: Request) {
  if (await limited(req, "auth")) return limitResponse("auth");
  const parsed = await readJson<{ key?: string }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const expected = modKey();
  const key = (parsed.value.key || "").trim();
  if (!expected || !key || !secretEquals(key, expected)) {
    return NextResponse.json({ error: "Bad key." }, { status: 401 });
  }
  await setModCookie();
  return NextResponse.json({ ok: true });
}
