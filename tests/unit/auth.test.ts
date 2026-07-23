import { describe, expect, it } from "vitest";

import {
  PinFailureTracker,
  createSessionToken,
  hashPin,
  isSameOrigin,
  refreshSessionToken,
  sessionCookieOptions,
  verifyPin,
  verifySessionToken,
  stablePinRateLimitKey,
  SESSION_IDLE_TIMEOUT_SECONDS,
} from "@/auth";

const secret = "a-secure-session-secret-that-is-at-least-32-characters";

describe("PIN authentication", () => {
  it("hashes and verifies a PIN without storing plaintext", async () => {
    const encoded = await hashPin("1234", { cost: 1_024 });
    expect(encoded).not.toContain("1234");
    await expect(verifyPin("1234", encoded)).resolves.toBe(true);
    await expect(verifyPin("9999", encoded)).resolves.toBe(false);
  });

  it("locks after five failures and unlocks after the cooldown", () => {
    const tracker = new PinFailureTracker();
    for (let i = 0; i < 4; i += 1) tracker.recordFailure("terminal", 1_000 + i);
    expect(tracker.isLocked("terminal", 2_000)).toBe(false);
    const locked = tracker.recordFailure("terminal", 3_000);
    expect(locked.lockedUntil).toBe(33_000);
    expect(tracker.isLocked("terminal", 32_999)).toBe(true);
    expect(tracker.isLocked("terminal", 33_000)).toBe(false);
  });
});

describe("signed sessions", () => {
  it("rejects tampering and refreshes activity expiry", () => {
    const token = createSessionToken(secret, 1_000_000);
    expect(verifySessionToken(secret, token, 1_000_001)).not.toBeNull();
    expect(verifySessionToken(secret, `${token}tampered`, 1_000_001)).toBeNull();
    const refreshed = refreshSessionToken(secret, token, 1_005_000);
    expect(refreshed).not.toBeNull();
    expect(verifySessionToken(secret, refreshed ?? "", 1_005_001)).not.toBeNull();
    expect(verifySessionToken(secret, token, 1_901_000)).toBeNull();
  });

  it("expires after 15 minutes of inactivity and extends expiry on activity", () => {
    const issuedAt = 2_000_000;
    const token = createSessionToken(secret, issuedAt);
    expect(verifySessionToken(secret, token, issuedAt + (SESSION_IDLE_TIMEOUT_SECONDS * 1_000) - 1_000)).not.toBeNull();
    expect(verifySessionToken(secret, token, issuedAt + (SESSION_IDLE_TIMEOUT_SECONDS * 1_000))).toBeNull();

    const refreshed = refreshSessionToken(secret, token, issuedAt + 60_000);
    expect(refreshed).not.toBeNull();
    expect(verifySessionToken(secret, refreshed ?? "", issuedAt + 60_000 + (SESSION_IDLE_TIMEOUT_SECONDS * 1_000) - 1_000)).not.toBeNull();
    expect(verifySessionToken(secret, refreshed ?? "", issuedAt + 60_000 + (SESSION_IDLE_TIMEOUT_SECONDS * 1_000))).toBeNull();
  });

  it("uses an HttpOnly Lax cookie with Secure only in production", () => {
    expect(sessionCookieOptions(false)).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
    expect(sessionCookieOptions(true).secure).toBe(true);
  });
});

describe("origin protection", () => {
  it("accepts only the exact same origin and host", () => {
    expect(
      isSameOrigin({ origin: "https://shop.example.com", requestOrigin: "https://shop.example.com/", host: "shop.example.com", expectedHost: "shop.example.com" }),
    ).toBe(true);
    expect(
      isSameOrigin({ origin: "https://evil.example.com", requestOrigin: "https://shop.example.com", host: "shop.example.com", expectedHost: "shop.example.com" }),
    ).toBe(false);
    expect(
      isSameOrigin({ origin: null, requestOrigin: "https://shop.example.com", host: "shop.example.com", expectedHost: "shop.example.com" }),
    ).toBe(false);
  });
});

describe("PIN rate-limit identity", () => {
  it("does not trust client-controlled forwarding headers", () => {
    const first = stablePinRateLimitKey(new Request("http://localhost/api/admin/session", { headers: { "x-forwarded-for": "198.51.100.10" } }));
    const second = stablePinRateLimitKey(new Request("http://localhost/api/admin/session", { headers: { "x-forwarded-for": "198.51.100.11" } }));
    expect(first).toBe("register-global");
    expect(second).toBe(first);
  });
});
