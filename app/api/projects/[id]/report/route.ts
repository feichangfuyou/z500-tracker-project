import { NextResponse } from "next/server";
import { shouldHideFromReports } from "@/lib/guardrails";
import { limited, limitResponse } from "@/lib/limit";
import { getSessionId } from "@/lib/session";
import { withStore } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (await limited(req, "write")) return limitResponse("write");
  const { id } = await params;
  const sid = await getSessionId();

  const result = await withStore((store) => {
    const project = store.community.find((p) => p.id === id);
    if (!project) return { error: "Only community-added entries can be reported.", status: 400 as const };
    if (store.reports.some((r) => r.mint === project.mint && r.sid === sid)) {
      return { error: "You already reported this mint.", status: 409 as const };
    }
    store.reports.push({ mint: project.mint, sid, at: Date.now() });
    project.reports += 1;
    if (shouldHideFromReports(project.reports)) {
      project.hidden = true;
    }
    const existing = store.moderation.find((m) => m.projectId === project.id && m.status === "open");
    if (!existing) {
      store.moderation.push({
        id: crypto.randomUUID(),
        mint: project.mint,
        projectId: project.id,
        status: project.hidden ? "hidden" : "open",
        createdAt: Date.now(),
      });
    } else if (project.hidden) {
      existing.status = "hidden";
    }
    return { reports: project.reports, hidden: project.hidden };
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
