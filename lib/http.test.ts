import { describe, expect, it } from "vitest";
import { readJson, secretEquals } from "./http";

describe("secretEquals", () => {
  it("accepts matching secrets", () => {
    expect(secretEquals("s3cret", "s3cret")).toBe(true);
  });

  it("rejects mismatches and different lengths", () => {
    expect(secretEquals("s3cret", "s3crex")).toBe(false);
    expect(secretEquals("short", "longer-key")).toBe(false);
    expect(secretEquals("", "x")).toBe(false);
  });
});

describe("readJson", () => {
  it("parses a small body", async () => {
    const got = await readJson<{ a: number }>(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ a: 1 }) }),
    );
    expect(got).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects invalid JSON", async () => {
    const got = await readJson(new Request("http://localhost", { method: "POST", body: "{nope" }));
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.status).toBe(400);
  });

  it("rejects null, arrays, and primitives", async () => {
    for (const body of ["null", "[]", "1", "true", '"str"']) {
      const got = await readJson(new Request("http://localhost", { method: "POST", body }));
      expect(got.ok).toBe(false);
      if (!got.ok) expect(got.status).toBe(400);
    }
  });

  it("rejects oversized payloads", async () => {
    const got = await readJson(new Request("http://localhost", { method: "POST", body: "x".repeat(40) }), 8);
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.status).toBe(413);
  });
});
