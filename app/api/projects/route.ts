import { NextResponse } from "next/server";
import { fetchAnsemCoins } from "@/lib/ansem";
import {
  addHits,
  isDuplicateMint,
  isValidAddress,
  overAddLimit,
  pruneAddLog,
} from "@/lib/guardrails";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { clientIp, getSessionId } from "@/lib/session";
import { withStore } from "@/lib/store";
import { ADD_RATE_LIMIT, TIERS } from "@/lib/types";

export async function POST(req: Request) {
  if (await limited(req, "write")) return limitResponse("write");
  const sid = await getSessionId();
  const ip = clientIp(req);

  const parsed = await readJson<{
    name?: string;
    mint?: string;
    tier?: string;
    burnAmount?: string | number;
    launchWallet?: string;
  }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;

  const name = (body.name || "").trim();
  const mint = (body.mint || "").trim();
  const launchWallet = (body.launchWallet || "").trim();
  const tier = TIERS.includes(body.tier as (typeof TIERS)[number]) ? body.tier! : "Unranked";
  const burnAmount = Number(body.burnAmount) || 0;

  if (!name || name.length > 48) {
    return NextResponse.json({ error: "Name is required (max 48 chars)." }, { status: 400 });
  }
  if (!isValidAddress(mint)) {
    return NextResponse.json({ error: "Mint address looks invalid." }, { status: 400 });
  }
  if (launchWallet && !isValidAddress(launchWallet)) {
    return NextResponse.json({ error: "Launch wallet looks invalid." }, { status: 400 });
  }

  let discovered: string[] = [];
  try {
    discovered = (await fetchAnsemCoins()).map((c) => c.mint);
  } catch {
    /* discovery down — still allow community add */
  }

  if (isDuplicateMint(discovered, mint)) {
    return NextResponse.json(
      { error: "That mint is already on the public ansem.io feed." },
      { status: 409 },
    );
  }

  const created = await withStore((store) => {
    const now = Date.now();
    store.addLog = pruneAddLog(store.addLog, now);
    if (overAddLimit(addHits(store.addLog, sid, ip), ADD_RATE_LIMIT)) {
      return { error: "Rate limit: max 5 community adds per hour.", status: 429 as const };
    }
    if (isDuplicateMint(store.community.filter((p) => !p.hidden).map((p) => p.mint), mint)) {
      return { error: "That mint is already tracked.", status: 409 as const };
    }
    const project = {
      id: crypto.randomUUID(),
      name,
      mint,
      tier,
      launchWallet: launchWallet || null,
      burnAmount,
      burnPriceRef: 0,
      addedAt: now,
      addedBy: sid,
      reports: 0,
      hidden: false,
    };
    store.community.push(project);
    store.addLog.push({ sid, ip, at: now });
    return { project };
  });

  if ("error" in created && created.error) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  return NextResponse.json(created, { status: 201 });
}
