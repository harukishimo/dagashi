import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep the local demo server and route mocks deterministic. The suite is
  // intentionally small; serial execution avoids cross-test session/cache
  // races while still covering the child and admin journeys.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      GOOGLE_SPREADSHEET_ID: "test-spreadsheet-id",
      GOOGLE_DRIVE_IMAGE_FOLDER_ID: "test-drive-folder-id",
      ADMIN_PIN_HASH: "test-pin-hash",
      SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
      APP_TIMEZONE: "Asia/Tokyo",
      NEXT_PUBLIC_APP_VERSION: "0.2.0-test",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
