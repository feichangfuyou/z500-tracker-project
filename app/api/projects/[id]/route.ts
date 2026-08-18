import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { limited, limitResponse } from "@/lib/limit";
import { getSessionId } from "@/lib/session";
import { withStore } from "@/lib/store";
import { TIERS } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (await limited(req, "write")) return limitResponse("write");
  const { id } = await params;
  const sid = await getSessionId();
  const parsed = await readJson<{ burnAmount?: string | number; tier?: string }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;
  if (body.tier && !TIERS.includes(body.tier as (typeof TIERS)[number])) {
    return NextResponse.json({ error: "Tier looks invalid." }, { status: 400 });
  }

  const result = await withStore((store) => {
    const project = store.community.find((p) => p.id === id);
    if (!project) return { error: "Not found", status: 404 as const };
    if (project.addedBy !== sid) {
      return { error: "Only the original adder can edit this entry.", status: 403 as const };
    }
    if (body.burnAmount !== undefined) project.burnAmount = Number(body.burnAmount) || 0;
    if (body.tier) project.tier = body.tier as (typeof TIERS)[number];
    return { project };
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (await limited(req, "write")) return limitResponse("write");
  const { id } = await params;
  const sid = await getSessionId();
  const result = await withStore((store) => {
    const project = store.community.find((p) => p.id === id);
    if (!project) return { error: "Not found", status: 404 as const };
    if (project.addedBy !== sid) {
      return { error: "Only the original adder can remove this entry.", status: 403 as const };
    }
    store.community = store.community.filter((p) => p.id !== id);
    return { ok: true };
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
