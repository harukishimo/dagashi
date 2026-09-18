import { describe, expect, it, vi } from "vitest";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleSheetsProductRepository, SHEET_HEADERS } from "@/infrastructure/google/repositories";

const tokenProvider = { getToken: async () => "token" } as never;
const id = "11111111-1111-4111-8111-111111111111";
const values = [[...SHEET_HEADERS.products], [id, "商品", "30", "駄菓子", "🍬", "image", "2026-09-18T00:00:00Z", "1", "active", "2026-09-18T00:00:00Z", "2026-09-18T00:00:00Z"]];

describe("image-only catalog reads", () => {
  it("collapses 18 concurrent image requests across client instances to one Sheets read without ledgers", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ values })));
    const products = await Promise.all(Array.from({ length: 18 }, () => new GoogleSheetsProductRepository(
      new GoogleSheetsClient({ spreadsheetId: "images-concurrent", tokenProvider, fetchImpl }),
    ).findImageProductById(id)));
    expect(products.every((product) => product?.imageFileId === "image")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(encodeURIComponent("products!A1:K1000"));
  });

  it("expires after 30 seconds and never caches normal stock reads", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ values })));
    const client = new GoogleSheetsClient({ spreadsheetId: "images-expiry", tokenProvider, fetchImpl });
    try {
      await client.getImageCatalog();
      await client.getImageCatalog();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      now.mockReturnValue(31001);
      await client.getImageCatalog();
      await client.getValues("products!A1:K1000");
      await client.getValues("products!A1:K1000");
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    } finally { now.mockRestore(); }
  });

  it("isolates spreadsheets and does not retain failed requests", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 403 }));
    const first = new GoogleSheetsClient({ spreadsheetId: "images-failed", tokenProvider, fetchImpl });
    await expect(first.getImageCatalog()).rejects.toMatchObject({ status: 403 });
    fetchImpl.mockImplementation(async () => new Response(JSON.stringify({ values })));
    await first.getImageCatalog();
    await new GoogleSheetsClient({ spreadsheetId: "images-other", tokenProvider, fetchImpl }).getImageCatalog();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
