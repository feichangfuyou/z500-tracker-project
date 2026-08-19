import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANSEM = "https://ansem.io";
const EXACT = new Set([
  "/api/coins",
  "/api/stats",
  "/api/boosts",
  "/api/market/ansem",
  "/api/leaderboard/projects",
]);

function allowed(path: string) {
  if (EXACT.has(path)) return true;
  return /^\/api\/coins\/[A-Za-z0-9._-]{1,80}$/.test(path);
}

Deno.serve(async (req) => {
  const path = new URL(req.url).searchParams.get("path") || "/api/leaderboard/projects";
  if (!allowed(path)) {
    return new Response(JSON.stringify({ error: "path not allowed" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const res = await fetch(`${ANSEM}${path}`, {
      headers: {
        accept: "application/json",
        origin: ANSEM,
        referer: `${ANSEM}/`,
        "user-agent": "Mozilla/5.0 (compatible; Crosscheck/1.0; +https://www.crosscheck.markets)",
      },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "public, max-age=20",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
});
