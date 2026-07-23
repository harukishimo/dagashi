import { describe, expect, it, vi } from "vitest";

const env = {
  GOOGLE_SPREADSHEET_ID: "sheet",
  GOOGLE_DRIVE_IMAGE_FOLDER_ID: "folder",
  GOOGLE_CLIENT_EMAIL: "service-account@example.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY: "private-key",
  ADMIN_PIN_HASH: "hash",
  SESSION_SECRET: "a-secure-session-secret-that-is-at-least-32-characters",
  APP_TIMEZONE: "Asia/Tokyo",
  NEXT_PUBLIC_APP_VERSION: "test",
};

const product = {
  productId: "11111111-1111-4111-8111-111111111111",
  name: "テスト商品",
  priceYen: 30,
  category: "チョコ",
  fallbackEmoji: "🍫",
  imageFileId: "drive-file-secret",
  imageUpdatedAt: "2026-07-23T00:00:00.000Z",
  displayOrder: 1,
  status: "active",
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

function mockCommonModules(): void {
  vi.doMock("@/config/env", () => ({ getServerEnv: () => env }));
  vi.doMock("@/infrastructure/google/auth", () => ({ GoogleAccessTokenProvider: class {} }));
  vi.doMock("@/infrastructure/google/sheets-client", () => ({ GoogleSheetsClient: class {} }));
}

describe("Drive route outage boundaries", () => {
  it("turns an image Drive outage into the normal 404 fallback", async () => {
    vi.resetModules();
    mockCommonModules();
    vi.doMock("@/infrastructure/google/repositories", () => ({
      GoogleSheetsProductRepository: class {
        async findById() { return product; }
      },
    }));
    vi.doMock("@/infrastructure/google/drive-client", async () => {
      const { AppError } = await import("@/lib/errors");
      return {
      GoogleDriveImageClient: class {
        async download() { throw new AppError("DRIVE_IMAGE_UNAVAILABLE", { retryable: true, status: 503 }); }
      },
      };
    });
    const { GET } = await import("@/app/api/product-images/[productId]/route");
    const response = await GET(new Request("https://example.test/api/product-images/11111111-1111-4111-8111-111111111111"), { params: Promise.resolve({ productId: product.productId }) });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("reports Drive health outages as an unhealthy 503 without identifiers", async () => {
    vi.resetModules();
    mockCommonModules();
    vi.doMock("@/infrastructure/google/repositories", () => ({
      GoogleSheetsSchemaRepository: class {
        async validateSchema() { return undefined; }
      },
    }));
    vi.doMock("@/infrastructure/google/drive-client", async () => {
      const { AppError } = await import("@/lib/errors");
      return {
      GoogleDriveImageClient: class {
        async checkFolderAccess() { throw new AppError("DRIVE_IMAGE_UNAVAILABLE", { retryable: true, status: 503 }); }
      },
      };
    });
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json() as { ok?: boolean; status?: string; error?: { code?: string; message?: string } };
    expect(body).toMatchObject({ ok: false, status: "unhealthy", error: { code: "DRIVE_IMAGE_UNAVAILABLE" } });
    expect(JSON.stringify(body)).not.toContain("drive-file-secret");
    expect(JSON.stringify(body)).not.toContain("folder");
  });
});
