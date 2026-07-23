import { describe, expect, it } from "vitest";

import { normalizePrivateKey, parsePublicEnv, parseServerEnv } from "@/config/env";

const baseEnv = {
  GOOGLE_SPREADSHEET_ID: "sheet-id",
  GOOGLE_DRIVE_IMAGE_FOLDER_ID: "folder-id",
  GOOGLE_CLIENT_EMAIL: "service@example.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
  ADMIN_PIN_HASH: "hash",
  SESSION_SECRET: "a-secure-session-secret-that-is-at-least-32-characters",
  APP_TIMEZONE: "Asia/Tokyo",
  NEXT_PUBLIC_APP_VERSION: "0.2.0-test",
};

describe("environment validation", () => {
  it("requires service-account credentials for Google API access", () => {
    expect(parseServerEnv(baseEnv)).toMatchObject({ ...baseEnv, GOOGLE_PRIVATE_KEY: normalizePrivateKey(baseEnv.GOOGLE_PRIVATE_KEY) });
  });

  it("requires service account variables as a pair", () => {
    expect(() => parseServerEnv({ ...baseEnv, GOOGLE_PRIVATE_KEY: undefined })).toThrow(
      /GOOGLE_PRIVATE_KEY/,
    );
  });

  it("normalizes escaped private-key line breaks", () => {
    expect(normalizePrivateKey("BEGIN\\nKEY")).toBe("BEGIN\nKEY");
  });

  it("rejects an invalid timezone", () => {
    expect(() => parseServerEnv({ ...baseEnv, APP_TIMEZONE: "not-a-timezone" })).toThrow(/APP_TIMEZONE/);
  });

  it("parses only public configuration for browser use", () => {
    expect(parsePublicEnv(baseEnv)).toEqual({ NEXT_PUBLIC_APP_VERSION: "0.2.0-test" });
  });
});
