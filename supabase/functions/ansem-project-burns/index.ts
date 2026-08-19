import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANSEM = "https://ansem.io/api/leaderboard/projects";

Deno.serve(async () => {
  try {
    const res = await fetch(ANSEM, {
      headers: {
        accept: "application/json",
        "user-agent": "crosscheck/1.0",
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
