import { ImageResponse } from "next/og";

export const alt = "Crosscheck — unofficial ansem.io launch tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default function Image() {
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
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#8d94a3" }}>UNOFFICIAL</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, lineHeight: 1 }}>CROSSCHECK</div>
          <div style={{ marginTop: 16, fontSize: 28, color: "#8d94a3", maxWidth: 920 }}>
            Unofficial tracker for coins launching on ansem.io. Not built or endorsed by ansem.io.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 2, color: "#4ade50" }}>crosscheck.markets</div>
      </div>
    ),
    { ...size },
  );
}
