import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { Product, Setting } from "@/domain/types";
import { ProductService } from "@/application/products/service";
import { AppError } from "@/lib/errors";
import { GoogleDriveImageClient, normalizeDriveFileId, type DriveImageRepository } from "@/infrastructure/google/drive-client";
import { GoogleSheetsProductRepository, GoogleSheetsSchemaRepository, GoogleSheetsSettingsRepository, SHEET_HEADERS } from "@/infrastructure/google/repositories";
import { GoogleAdminDataRepository } from "@/application/admin/data";
import { GoogleSheetsSaleRepository } from "@/infrastructure/google/sales-repositories";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";

describe("Drive product images", () => {
  it("normalizes supported share URLs and direct IDs", () => {
    expect(normalizeDriveFileId("abc_123-xyz")).toBe("abc_123-xyz");
    expect(normalizeDriveFileId("https://drive.google.com/file/d/abc_123-xyz/view")).toBe("abc_123-xyz");
    expect(normalizeDriveFileId("https://drive.google.com/open?id=abc_123-xyz")).toBe("abc_123-xyz");
  });

  it("rejects folder URLs and external URLs", () => {
    expect(() => normalizeDriveFileId("https://drive.google.com/drive/folders/abc_123-xyz")).toThrow(AppError);
    expect(() => normalizeDriveFileId("https://example.com/file/d/abc_123-xyz/view")).toThrow(AppError);
    expect(() => normalizeDriveFileId("https://drive.google.com/file/d/not valid/view")).toThrow(AppError);
  });

  it("requires the configured parent, supported mime and 500KB limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "abc", name: "x.png", mimeType: "image/png", size: "10", modifiedTime: "2026-07-23T00:00:00Z", parents: ["folder"], trashed: false }), { status: 200 }));
    const client = new GoogleDriveImageClient({ folderId: "folder", tokenProvider: { getToken: vi.fn(async () => "token") } as never, fetchImpl });
    await expect(client.inspect("abc")).resolves.toMatchObject({ mimeType: "image/png", size: 10 });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("classifies final Drive network failures as retryable image outages", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network unavailable");
    });
    const client = new GoogleDriveImageClient({ folderId: "folder", tokenProvider: { getToken: vi.fn(async () => "token") } as never, fetchImpl, sleep: async () => undefined });
    await expect(client.inspect("abc")).rejects.toMatchObject({ code: "DRIVE_IMAGE_UNAVAILABLE", retryable: true, status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("Google Sheets product repository", () => {
  const product: Product = {
    productId: "11111111-1111-4111-8111-111111111111",
    name: "[テスト] チョコスナック",
    priceYen: 30,
    category: "チョコ",
    fallbackEmoji: "🍫",
    imageFileId: null,
    imageUpdatedAt: null,
    displayOrder: 10,
    status: "active",
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };

  it("reads the schema and converts rows without formula evaluation", async () => {
    const client = {
      getValues: vi.fn(async (range: string) => ({ values: range.startsWith("products!L") ? [] : [[...SHEET_HEADERS.products], [product.productId, "=1+1", "30", "チョコ", "🍫", "", "", "10", "active", product.createdAt, product.updatedAt]] })),
    };
    const repository = new GoogleSheetsProductRepository(client as never);
    const rows = await repository.listAll();
    expect(rows[0]?.name).toBe("=1+1");
  });

  it("rejects missing or reordered headers", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [["product_id"]] })) };
    await expect(new GoogleSheetsProductRepository(client as never).listAll()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });

  it("reads stock totals and saves a stocktake as total plus prior consumption", async () => {
    vi.spyOn(GoogleAdminDataRepository.prototype, "listSales").mockResolvedValue([]);
    vi.spyOn(GoogleAdminDataRepository.prototype, "listSaleItems").mockResolvedValue([]);
    vi.spyOn(GoogleAdminDataRepository.prototype, "listRewards").mockResolvedValue([
      { redemptionId: "r", productId: product.productId, status: "completed", quantity: 3 } as never,
    ]);
    const row = [product.productId, product.name, "30", product.category, product.fallbackEmoji, "", "", "10", "active", product.createdAt, product.updatedAt];
    const client = {
      getValues: vi.fn(async (range: string) => ({ values: range === "products!L1:L1000" ? [["stock_total"], ["5"]] : range === "products!L1" ? [["stock_total"]] : range === "products!A1:A1000" ? [["product_id"], [product.productId]] : [[...SHEET_HEADERS.products], row] })),
      updateValues: vi.fn(async () => undefined),
    };
    try {
      const repository = new GoogleSheetsProductRepository(client as never);
      expect((await repository.listAll())[0].stockQuantity).toBe(2);
      await repository.update({ ...product, stockQuantity: 8 });
      expect(client.updateValues).toHaveBeenCalledWith("products!L2", [["11"]]);
    } finally { vi.restoreAllMocks(); }
  });

  it("rejects product rows with extra columns", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [[...SHEET_HEADERS.products], [product.productId, product.name, "30", product.category, product.fallbackEmoji, "", "", "10", "active", product.createdAt, product.updatedAt, "unexpected"]] })) };
    await expect(new GoogleSheetsProductRepository(client as never).listAll()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });

  it("rejects settings rows with extra columns", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [[...SHEET_HEADERS.settings], ["shop_enabled", "true", "2026-07-23T00:00:00.000Z", "unexpected"]] })) };
    await expect(new GoogleSheetsSettingsRepository(client as never).list()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });

  it("validates base tabs, event extensions and challenge setting", async () => {
    const valuesByRange: Record<string, string[][]> = {
      "products!A1:K1": [[...SHEET_HEADERS.products]],
      "sales!A1:O1": [[...SHEET_HEADERS.sales]],
      "sale_items!A1:H1": [[...SHEET_HEADERS.sale_items]],
      "reward_redemptions!A1:K1": [[...SHEET_HEADERS.reward_redemptions]],
      "settings!A1:C1": [[...SHEET_HEADERS.settings]],
      "audit_logs!A1:F1": [[...SHEET_HEADERS.audit_logs]],
      "settings!A1:C100": [[...SHEET_HEADERS.settings], ["schema_version", "2", "2026-07-23T00:00:00.000Z"], ["challenge_enabled", "true", "2026-09-18T00:00:00.000Z"]],
      "sales!P1:Q1": [["event_id", "event_name_snapshot"]],
      "events!A1:F1": [["event_id", "name", "start_date", "end_date", "created_at", "status"]],
    };
    const client = { getValues: vi.fn(async (range: string) => ({ values: valuesByRange[range] ?? [] })) };
    await expect(new GoogleSheetsSchemaRepository(client as never).validateSchema()).resolves.toBeUndefined();
    valuesByRange["events!A1:F1"] = [];
    await expect(new GoogleSheetsSchemaRepository(client as never).validateSchema()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });
});

describe("Google Sheets transport safety", () => {
  const tokenProvider = { getToken: vi.fn(async () => "token") } as never;

  it("does not expose Google error body and does not retry append", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: { message: "SECRET_SPREADSHEET_ID" } }), { status: 500 }));
    const client = new GoogleSheetsClient({ spreadsheetId: "sheet", tokenProvider, fetchImpl, sleep: async () => undefined });
    await expect(client.appendValues("audit_logs!A:F", [["x"]])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    try {
      await client.appendValues("sales!A:O", [["x"]], { uncertainWrite: true });
    } catch (error) {
      expect(error).toMatchObject({ code: "SALE_STATUS_UNKNOWN" });
      expect(String(error)).not.toContain("SECRET_SPREADSHEET_ID");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("provides an abort signal for finite Google API requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal).toBeDefined();
      return new Response(JSON.stringify({ values: [] }), { status: 200 });
    });
    const client = new GoogleSheetsClient({ spreadsheetId: "sheet", tokenProvider, fetchImpl });
    await client.getValues("products!A1:K1");
  });

  it("classifies invalid success JSON as a retryable Sheets outage", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("not-json", { status: 200 }));
    const client = new GoogleSheetsClient({ spreadsheetId: "sheet", tokenProvider, fetchImpl, sleep: async () => undefined });
    await expect(client.getValues("products!A1:K1")).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE", retryable: true, status: 503, details: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("classifies final Sheets network failures without exposing raw exceptions", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new TypeError("network unavailable"); });
    const client = new GoogleSheetsClient({ spreadsheetId: "sheet", tokenProvider, fetchImpl, sleep: async () => undefined });
    await expect(client.getValues("products!A1:K1")).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE", retryable: true, status: 503, details: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("never retries any non-idempotent append range", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: { message: "temporary" } }), { status: 500 }));
    const client = new GoogleSheetsClient({ spreadsheetId: "sheet", tokenProvider, fetchImpl, sleep: async () => undefined });
    const ranges = ["products!A:K", "sales!A:O", "sale_items!A:H", "reward_redemptions!A:K", "settings!A:C", "audit_logs!A:F"];
    for (const range of ranges) {
      await expect(client.appendValues(range, [["value"]])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(ranges.length);
  });

  it("bounds OAuth token requests and classifies timeout as retryable", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal).toBeDefined();
      throw new DOMException("timed out", "TimeoutError");
    });
    const provider = new GoogleAccessTokenProvider({
      clientEmail: "service-account@example.iam.gserviceaccount.com",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    }, fetchImpl);
    await expect(provider.getToken()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE", retryable: true });
  });
});

describe("strict sales row validation", () => {
  it("rejects unknown enums and out-of-range quantities", async () => {
    const saleHeader = [...SHEET_HEADERS.sales];
    const itemHeader = [...SHEET_HEADERS.sale_items];
    const invalidSale = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "2026-07-23T00:00:00.000Z", "bogus", "completed", "30", "cash", "completed", "", "", "", "", "", "2026-07-23T00:00:00.000Z", "2026-07-23T00:00:00.000Z"];
    const client = {
      getValues: vi.fn(async (range: string) => range.startsWith("sales!") ? { values: [saleHeader, invalidSale] } : { values: [itemHeader, ["33333333-3333-4333-8333-333333333333", "11111111-1111-4111-8111-111111111111", "44444444-4444-4444-8444-444444444444", "商品", "30", "100", "3000", "2026-07-23T00:00:00.000Z"]] }),
    };
    const repository = new GoogleSheetsSaleRepository(client as never);
    await expect(repository.findById("11111111-1111-4111-8111-111111111111")).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    await expect(repository.listItemsBySaleId("11111111-1111-4111-8111-111111111111")).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });

  it("rejects blank required numbers and rows with extra columns in sales repositories", async () => {
    const saleHeader = [...SHEET_HEADERS.sales];
    const itemHeader = [...SHEET_HEADERS.sale_items];
    const validSale = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "2026-07-23T00:00:00.000Z", "completed", "completed", "30", "cash", "completed", "10000", "TRUE", "2", "", "", "2026-07-23T00:00:00.000Z", "2026-07-23T00:00:00.000Z"];
    const validItem = ["33333333-3333-4333-8333-333333333333", "11111111-1111-4111-8111-111111111111", "44444444-4444-4444-8444-444444444444", "商品", "30", "1", "30", "2026-07-23T00:00:00.000Z"];
    const blankTotal = [...validSale];
    blankTotal[5] = "  ";
    const extraSale = [...validSale, "unexpected"];
    const blankUnitPrice = [...validItem];
    blankUnitPrice[4] = "\t";
    const extraItem = [...validItem, "unexpected"];
    const client = {
      getValues: vi.fn(async (range: string) => {
        if (range.startsWith("sales!")) return { values: [saleHeader, blankTotal] };
        return { values: [itemHeader, blankUnitPrice] };
      }),
    };
    const repository = new GoogleSheetsSaleRepository(client as never);
    await expect(repository.findById(validSale[0])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    await expect(repository.listItemsBySaleId(validSale[0])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });

    const extraClient = {
      getValues: vi.fn(async (range: string) => range.startsWith("sales!") ? { values: [saleHeader, extraSale] } : { values: [itemHeader, extraItem] }),
    };
    const extraRepository = new GoogleSheetsSaleRepository(extraClient as never);
    await expect(extraRepository.findById(validSale[0])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    await expect(extraRepository.listItemsBySaleId(validSale[0])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });

  it("applies the same strict row boundary to admin sales data", async () => {
    const saleHeader = [...SHEET_HEADERS.sales];
    const itemHeader = [...SHEET_HEADERS.sale_items];
    const validSale = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "2026-07-23T00:00:00.000Z", "completed", "completed", "30", "cash", "completed", "10000", "TRUE", "2", "", "", "2026-07-23T00:00:00.000Z", "2026-07-23T00:00:00.000Z"];
    const validItem = ["33333333-3333-4333-8333-333333333333", "11111111-1111-4111-8111-111111111111", "44444444-4444-4444-8444-444444444444", "商品", "30", "1", "30", "2026-07-23T00:00:00.000Z"];
    const blankSale = [...validSale];
    blankSale[5] = "";
    const extraItem = [...validItem, "unexpected"];
    const client = {
      getValues: vi.fn(async (range: string) => range.startsWith("sales!") ? { values: [saleHeader, blankSale] } : { values: [itemHeader, extraItem] }),
    };
    const repository = new GoogleAdminDataRepository(client as never);
    await expect(repository.listSales()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    await expect(repository.listSaleItems()).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
  });
});

describe("product service image fallback", () => {
  const base: Product = {
    productId: "11111111-1111-4111-8111-111111111111",
    name: "テスト商品",
    priceYen: 30,
    category: "チョコ",
    fallbackEmoji: "🍫",
    imageFileId: null,
    imageUpdatedAt: null,
    displayOrder: 1,
    status: "active",
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };

  it("allows active products with emoji and no Drive image", async () => {
    const products = { listAll: vi.fn(async () => []), findById: vi.fn(async () => null), create: vi.fn(async (value) => value), update: vi.fn(async (value) => value) };
    const images: DriveImageRepository = { normalizeFileId: (value) => value, inspect: vi.fn(), download: vi.fn() };
    const service = new ProductService({ products, images, audit: { append: vi.fn(async () => undefined) }, now: () => new Date("2026-07-23T00:00:00.000Z") });
    const result = await service.create({ name: base.name, priceYen: 30, category: base.category, fallbackEmoji: base.fallbackEmoji, displayOrder: 1, status: "active" });
    expect(result.product.fallbackEmoji).toBe("🍫");
    expect(result.product.imageFileId).toBeNull();
    expect(images.inspect).not.toHaveBeenCalled();
  });

  it("rejects a configured invalid Drive image while preserving emoji fallback as a valid option", async () => {
    const products = { listAll: vi.fn(async () => []), findById: vi.fn(async () => null), create: vi.fn(async (value) => value), update: vi.fn(async (value) => value) };
    const images: DriveImageRepository = { normalizeFileId: (value) => value, inspect: vi.fn(async () => { throw new AppError("DRIVE_IMAGE_UNAVAILABLE"); }), download: vi.fn() };
    const service = new ProductService({ products, images, audit: { append: vi.fn(async () => undefined) } });
    const result = await service.create({ name: base.name, priceYen: 30, category: base.category, fallbackEmoji: base.fallbackEmoji, imageSource: "bad", displayOrder: 1, status: "active" });
    expect(result.product.imageFileId).toBeNull();
    expect(result.imageWarning).toContain("フォールバック絵文字");
  });

  it("hides active products when the Spreadsheet shop_enabled setting is false", async () => {
    const products = { listAll: vi.fn(async () => [base]), findById: vi.fn(async () => base), create: vi.fn(async (value) => value), update: vi.fn(async (value) => value) };
    const images: DriveImageRepository = { normalizeFileId: (value) => value, inspect: vi.fn(), download: vi.fn() };
    const settings = { list: vi.fn(async () => []), find: vi.fn(async (): Promise<Setting | null> => ({ key: "shop_enabled", value: "false", updatedAt: "" })) };
    const service = new ProductService({ products, images, settings, audit: { append: vi.fn(async () => undefined) } });
    await expect(service.list({ activeOnly: true })).resolves.toEqual([]);
  });

  it("keeps active products visible when shop_enabled is true or absent", async () => {
    const products = { listAll: vi.fn(async () => [base]), findById: vi.fn(async () => base), create: vi.fn(async (value) => value), update: vi.fn(async (value) => value) };
    const images: DriveImageRepository = { normalizeFileId: (value) => value, inspect: vi.fn(), download: vi.fn() };
    const settings = { list: vi.fn(async () => []), find: vi.fn(async (): Promise<Setting | null> => ({ key: "shop_enabled", value: "true", updatedAt: "" })) };
    const service = new ProductService({ products, images, settings, audit: { append: vi.fn(async () => undefined) } });
    await expect(service.list({ activeOnly: true })).resolves.toEqual([base]);
    settings.find.mockResolvedValue(null);
    await expect(service.list({ activeOnly: true })).resolves.toEqual([base]);
  });
});
