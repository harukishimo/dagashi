import { describe, expect, it, vi } from "vitest";

const sessionSecret = "a-secure-session-secret-that-is-at-least-32-characters";

vi.mock("@/config/env", () => ({
  getServerEnv: () => ({ SESSION_SECRET: sessionSecret }),
}));

import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "@/auth";
import { refreshAdminSessionCookie } from "@/application/admin/require-admin-session";

describe("admin session refresh response", () => {
  it("sets a refreshed HttpOnly cookie after an active operation", () => {
    const issuedAt = Date.now() - 60_000;
    const token = createSessionToken(sessionSecret, issuedAt);
    const request = new Request("https://example.test/api/admin/dashboard", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    const response = refreshAdminSessionCookie(request, NextResponse.json({ ok: true }));
    const cookie = response.headers.get("set-cookie") ?? "";
    const refreshedToken = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    expect(refreshedToken).toBeTruthy();
    expect(cookie).toContain("HttpOnly");
    expect(verifySessionToken(sessionSecret, refreshedToken ?? "", Date.now())).not.toBeNull();
  });

  it("does not refresh a session that has already been idle for 15 minutes", () => {
    const issuedAt = Date.now() - (15 * 60 * 1_000) - 1_000;
    const token = createSessionToken(sessionSecret, issuedAt);
    const request = new Request("https://example.test/api/admin/dashboard", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    const response = refreshAdminSessionCookie(request, NextResponse.json({ ok: true }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
