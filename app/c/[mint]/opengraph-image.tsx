import { ImageResponse } from "next/og";
import { loadCoin } from "@/lib/coin";
import { isValidAddress } from "@/lib/guardrails";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const payload = isValidAddress(mint) ? await loadCoin(mint) : null;
  const p = payload?.project;
  const title = p?.name || "Crosscheck";
  const ticker = p?.ticker ? `$${p.ticker}` : mint.slice(0, 8);
  const rank = p?.officialRank != null ? `#${p.officialRank}` : "—";
  const score = p ? Math.round(p.score).toLocaleString() : "—";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07080c",
          color: "#e8ecf2",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#8d94a3" }}>CROSSCHECK</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, lineHeight: 1 }}>{title}</div>
          <div style={{ marginTop: 12, fontSize: 28, color: "#8d94a3" }}>{ticker}</div>
        </div>
        <div style={{ display: "flex", gap: 48, fontSize: 28 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#8d94a3", fontSize: 16 }}>SCORE</span>
            <span>{score}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#8d94a3", fontSize: 16 }}>OFFICIAL</span>
            <span>{rank}</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
