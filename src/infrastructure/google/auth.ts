import { createSign } from "node:crypto";

import { AppError } from "@/lib/errors";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets";

export interface GoogleServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

export type GoogleFetch = typeof fetch;

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function serviceAccountAssertion(credentials: GoogleServiceAccountCredentials, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: TOKEN_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

/**
 * Server-only OAuth token provider. Credentials are never returned to callers
 * or included in error messages.
 */
export class GoogleAccessTokenProvider {
  private cached: { token: string; expiresAt: number } | undefined;

  constructor(
    private readonly credentials: GoogleServiceAccountCredentials,
    private readonly fetchImpl: GoogleFetch = fetch,
  ) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now + 60_000) return this.cached.token;

    let response: Response;
    try {
      response = await this.fetchImpl(TOKEN_URL, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: serviceAccountAssertion(this.credentials, now),
        }),
      });
    } catch (error) {
      throw new AppError("SHEETS_UNAVAILABLE", { retryable: true, cause: error });
    }

    const payload = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new AppError("SHEETS_UNAVAILABLE", { retryable: response.status >= 500, status: response.status || 503 });
    }

    const expiresIn = Math.max(60, payload.expires_in ?? 3600);
    this.cached = { token: payload.access_token, expiresAt: now + expiresIn * 1000 };
    return payload.access_token;
  }
}

export function createServiceAccountTokenProvider(
  credentials: GoogleServiceAccountCredentials | undefined,
  fetchImpl?: GoogleFetch,
): GoogleAccessTokenProvider | undefined {
  if (!credentials) return undefined;
  return new GoogleAccessTokenProvider(credentials, fetchImpl);
}
