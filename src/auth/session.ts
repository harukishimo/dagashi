import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "dagashi_staff_session";
export const SESSION_IDLE_TIMEOUT_SECONDS = 15 * 60;

export interface SessionPayload {
  sub: "staff";
  sessionId: string;
  issuedAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function createSessionToken(secret: string, now = Date.now()): string {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const issuedAt = Math.floor(now / 1_000);
  const payload: SessionPayload = {
    sub: "staff",
    sessionId: randomUUID(),
    issuedAt,
    lastActivityAt: issuedAt,
    expiresAt: issuedAt + SESSION_IDLE_TIMEOUT_SECONDS,
  };
  return signPayload(secret, payload);
}

export function verifySessionToken(secret: string, token: string, now = Date.now()): SessionPayload | null {
  if (secret.length < 32 || !token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const received = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (
      payload.sub !== "staff" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.lastActivityAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }
    const nowSeconds = Math.floor(now / 1_000);
    // The session uses a sliding idle timeout. The absolute expiry is kept in
    // the token as a client-visible hint, while lastActivityAt is the source
    // of truth for rejecting sessions that have been idle for 15 minutes.
    if (payload.expiresAt <= nowSeconds || nowSeconds - payload.lastActivityAt >= SESSION_IDLE_TIMEOUT_SECONDS) return null;
    if (payload.lastActivityAt > nowSeconds + 30) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function refreshSessionToken(secret: string, token: string, now = Date.now()): string | null {
  const session = verifySessionToken(secret, token, now);
  if (!session) return null;
  const nowSeconds = Math.floor(now / 1_000);
  return signPayload(secret, {
    ...session,
    lastActivityAt: nowSeconds,
    expiresAt: nowSeconds + SESSION_IDLE_TIMEOUT_SECONDS,
  });
}

export function sessionCookieOptions(isProduction = process.env.NODE_ENV === "production"): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
  };
}

function signPayload(secret: string, payload: SessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
