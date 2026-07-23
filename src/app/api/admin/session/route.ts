import { NextResponse } from "next/server";

import { createSessionToken, PinFailureTracker, stablePinRateLimitKey, verifyPin, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/auth";
import { getServerEnv } from "@/config/env";
import { hasValidRequestOrigin, getAdminSession, refreshAdminSessionCookie } from "@/application/admin/require-admin-session";
import { AppError, toAppError } from "@/lib/errors";

const failures = new PinFailureTracker();

/**
 * The MVP runs one register. Do not trust client-controlled forwarding headers
 * as a limiter identity: rotating X-Forwarded-For must not bypass lockout.
 * A trusted-proxy keyed limiter can be introduced with an explicit deployment
 * contract when this app is deployed behind a known proxy.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getAdminSession(request);
  return refreshAdminSessionCookie(request, NextResponse.json({ authenticated: Boolean(session), expiresAt: session?.expiresAt ?? null }));
}

export async function POST(request: Request): Promise<Response> {
  if (!hasValidRequestOrigin(request)) {
    const error = new AppError("FORBIDDEN", { details: ["Originが一致しません"] });
    return NextResponse.json(error.toResponse(), { status: error.status });
  }
  const key = stablePinRateLimitKey(request);
  const now = Date.now();
  if (failures.isLocked(key, now)) {
    const state = failures.getState(key);
    const error = new AppError("RATE_LIMITED", { retryable: true, details: ["PIN入力が一時停止中です"] });
    const response = NextResponse.json(error.toResponse(), { status: error.status });
    response.headers.set("Retry-After", String(Math.max(1, Math.ceil(((state.lockedUntil ?? now) - now) / 1_000))));
    return response;
  }

  try {
    const body = (await request.json()) as { pin?: unknown };
    const pin = typeof body.pin === "string" ? body.pin : "";
    if (!/^\d{4,8}$/.test(pin)) throw new AppError("VALIDATION_ERROR", { details: ["PINは4〜8桁の数字で入力してください"] });
    const env = getServerEnv();
    const valid = await verifyPin(pin, env.ADMIN_PIN_HASH);
    if (!valid) {
      const state = failures.recordFailure(key, now);
      const error = new AppError("UNAUTHORIZED", { details: ["PINが一致しません"] });
      const response = NextResponse.json(error.toResponse(), { status: error.status });
      if (state.lockedUntil) response.headers.set("Retry-After", String(Math.ceil((state.lockedUntil - now) / 1_000)));
      return response;
    }
    failures.reset(key);
    const token = createSessionToken(env.SESSION_SECRET, now);
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(process.env.NODE_ENV === "production"));
    return response;
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!hasValidRequestOrigin(request)) {
    const error = new AppError("FORBIDDEN", { details: ["Originが一致しません"] });
    return NextResponse.json(error.toResponse(), { status: error.status });
  }
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(process.env.NODE_ENV === "production"), maxAge: 0 });
  return response;
}
