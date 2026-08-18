import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { isMod } from "@/lib/mod-auth";
import { readStore, withStore } from "@/lib/store";

export async function GET() {
  if (!(await isMod())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = await readStore();
  const queue = store.moderation
    .map((m) => {
      const project = store.community.find((p) => p.id === m.projectId);
      return {
        ...m,
        name: project?.name || m.mint,
        reports: project?.reports || 0,
        hidden: project?.hidden || false,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ queue });
}

export async function POST(req: Request) {
  if (!(await isMod())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJson<{ id?: string; action?: "hide" | "dismiss" | "restore" }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;
  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action required" }, { status: 400 });
  }

  const result = await withStore((store) => {
    const item = store.moderation.find((m) => m.id === body.id);
    if (!item) return { error: "Not found", status: 404 as const };
    const project = store.community.find((p) => p.id === item.projectId);
    if (body.action === "hide") {
      item.status = "hidden";
      if (project) project.hidden = true;
    } else if (body.action === "restore") {
      item.status = "dismissed";
      if (project) project.hidden = false;
    } else {
      item.status = "dismissed";
    }
    return { item, hidden: project?.hidden ?? false };
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
