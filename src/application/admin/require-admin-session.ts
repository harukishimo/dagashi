import { getServerEnv } from "@/config/env";
import { isSameOrigin, SESSION_COOKIE_NAME, refreshSessionToken, sessionCookieOptions, verifySessionToken, type SessionPayload } from "@/auth";
import { NextResponse } from "next/server";

export interface AdminRequestCheckOptions {
  requireOrigin?: boolean;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

function requestOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function hasValidRequestOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const currentOrigin = requestOrigin(request);
  if (!host || !origin || !currentOrigin) return false;
  return isSameOrigin({ origin, requestOrigin: currentOrigin, host, expectedHost: host });
}

export async function getAdminSession(request: Request): Promise<SessionPayload | null> {
  try {
    const { SESSION_SECRET } = getServerEnv();
    const token = readCookie(request, SESSION_COOKIE_NAME);
    return token ? verifySessionToken(SESSION_SECRET, token) : null;
  } catch {
    return null;
  }
}

/**
 * Refresh a valid staff session after an authenticated operation. Keeping the
 * cookie write here ensures every protected route uses the same idle-timeout
 * policy and never exposes a refreshed token to client JavaScript.
 */
export function refreshAdminSessionCookie(request: Request, response: Response): Response {
  try {
    const { SESSION_SECRET } = getServerEnv();
    const token = readCookie(request, SESSION_COOKIE_NAME);
    const refreshed = token ? refreshSessionToken(SESSION_SECRET, token) : null;
    if (refreshed && response instanceof NextResponse) {
      response.cookies.set(SESSION_COOKIE_NAME, refreshed, sessionCookieOptions(process.env.NODE_ENV === "production"));
    }
  } catch {
    // A response should still be returned when env validation fails. The route
    // has already completed its normal error handling in that case.
  }
  return response;
}

export async function requireAdminSession(
  request: Request,
  options: AdminRequestCheckOptions = {},
): Promise<boolean> {
  if (options.requireOrigin && !hasValidRequestOrigin(request)) return false;
  return Boolean(await getAdminSession(request));
}

export function getSessionCookieValue(request: Request): string | null {
  return readCookie(request, SESSION_COOKIE_NAME);
}
