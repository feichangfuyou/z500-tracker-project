import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    },
  }),
}));

import { NextResponse } from "next/server";
import { attachSessionCookie, getSessionId, readSessionId } from "./session";

describe("session", () => {
  it("still returns a sid if cookie writes are blocked", async () => {
    await expect(getSessionId()).resolves.toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("reads an empty sid when no cookie is present", async () => {
    await expect(readSessionId()).resolves.toBe("");
  });

  it("attaches the session cookie on the response", () => {
    const res = attachSessionCookie(NextResponse.json({ ok: true }), "sid-test");
    expect(res.cookies.get("tracker_sid")?.value).toBe("sid-test");
  });
});
