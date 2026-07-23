export interface OriginCheckInput {
  origin: string | null | undefined;
  requestOrigin: string;
  host: string | null | undefined;
  expectedHost?: string;
}

/** Same-origin guard for state-changing requests. Missing Origin is rejected by default. */
export function isSameOrigin(input: OriginCheckInput): boolean {
  if (!input.origin || !input.requestOrigin || !input.host) return false;
  let origin: URL;
  let expected: URL;
  try {
    origin = new URL(input.origin);
    expected = new URL(input.requestOrigin);
  } catch {
    return false;
  }

  if (origin.origin !== expected.origin) return false;
  const expectedHost = input.expectedHost ?? expected.host;
  if (normalizeHost(input.host) !== normalizeHost(expectedHost)) {
    return false;
  }
  return true;
}

export function assertSameOrigin(input: OriginCheckInput): void {
  if (!isSameOrigin(input)) {
    throw new Error("Origin check failed");
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}
