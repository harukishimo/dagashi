import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSheetsProductRepository, SHEET_HEADERS } from "@/infrastructure/google/repositories";
import { GoogleAdminDataRepository } from "@/application/admin/data";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { bulkStockSchema } from "@/domain/stock-update";
import { withInventoryLock } from "@/application/inventory-lock";
import { ProductService } from "@/application/products/service";
import { PATCH } from "@/app/api/admin/products/stock/route";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const oldDate = "2026-11-19T01:00:00.000Z";
const newDate = "2026-11-19T02:00:00.000Z";
function fixture() {
  const values = [[...SHEET_HEADERS.products, "stock_total"], ...[a, b].map((id, index) => [id, "おかし", "30", "駄菓子", "🍬", "file", oldDate, String(index), "active", oldDate, oldDate, index ? "6" : "10"])];
  const client = { getValues: vi.fn(async () => ({ values })), batchUpdateValues: vi.fn(async () => undefined) };
  return { values, client, repository: new GoogleSheetsProductRepository(client as never) };
}
const updates = [{ productId: a, stockQuantity: 20, expectedStockQuantity: 7, expectedUpdatedAt: oldDate }, { productId: b, stockQuantity: null, expectedStockQuantity: 5, expectedUpdatedAt: oldDate }];
beforeEach(() => {
  vi.spyOn(GoogleAdminDataRepository.prototype, "listSales").mockResolvedValue([{ saleId: "s", saleStatus: "completed" }] as never);
  vi.spyOn(GoogleAdminDataRepository.prototype, "listSaleItems").mockResolvedValue([{ saleItemId: "i1", saleId: "s", productId: a, quantity: 2 }, { saleItemId: "i2", saleId: "s", productId: b, quantity: 1 }] as never);
  vi.spyOn(GoogleAdminDataRepository.prototype, "listRewards").mockResolvedValue([{ redemptionId: "r", productId: a, quantity: 1, status: "completed" }] as never);
});
afterEach(() => vi.restoreAllMocks());

describe("bulk stocktake", () => {
  it("saves current stock plus ledger consumption in one stock-only batch", async () => {
    const { client, repository } = fixture();
    await repository.updateStocks(updates, newDate);
    expect(client.batchUpdateValues).toHaveBeenCalledExactlyOnceWith([
      { range: "products!K2:L2", values: [[newDate, "23"]] },
      { range: "products!K3:L3", values: [[newDate, ""]] },
    ]);
  });
  it.each(["stock", "updatedAt"])("writes nothing if any %s baseline changed", async field => {
    const { client, repository, values } = fixture();
    values[2][field === "stock" ? 11 : 10] = field === "stock" ? "5" : newDate;
    await expect(repository.updateStocks(updates, newDate)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(client.batchUpdateValues).not.toHaveBeenCalled();
  });
  it("rejects duplicate/missing products and invalid input before any write", async () => {
    for (const invalid of [[], [updates[0], updates[0]], [{ ...updates[0], stockQuantity: -1 }], [{ ...updates[0], stockQuantity: .5 }], [{ ...updates[0], stockQuantity: "2" }]]) expect(bulkStockSchema.safeParse({ updates: invalid }).success).toBe(false);
    const { client, repository } = fixture();
    await expect(repository.updateStocks([{ ...updates[0], productId: "33333333-3333-4333-8333-333333333333" }], newDate)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(client.batchUpdateValues).not.toHaveBeenCalled();
  });
  it("reports an audit warning as saved instead of asking to repeat a completed stocktake", async () => {
    const updateStocks = vi.fn(async () => undefined);
    const service = new ProductService({ products: { updateStocks } as never, images: {} as never, audit: { append: vi.fn(async () => { throw new Error("offline"); }) } });
    const result = await service.updateStocks({ updates });
    expect(result.updatedCount).toBe(2);
    expect(result.warning).toContain("在庫は保存しました");
    expect(updateStocks).toHaveBeenCalledTimes(1);
  });
  it("does not retry a batch after an uncertain Google response", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 503 }));
    const client = new GoogleSheetsClient({ spreadsheetId: "sheet", tokenProvider: { getToken: async () => "token" } as never, fetchImpl, sleep: async () => undefined });
    await expect(client.batchUpdateValues([{ range: "products!K2:L2", values: [[newDate, "20"]] }])).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("serializes stocktake and checkout tasks sharing the inventory lock", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const order: string[] = [];
    const first = withInventoryLock(async () => { order.push("checkout"); await gate; });
    const second = withInventoryLock(async () => { order.push("stocktake"); });
    await Promise.resolve();
    expect(order).toEqual(["checkout"]);
    release(); await Promise.all([first, second]);
    expect(order).toEqual(["checkout", "stocktake"]);
  });
  it("requires admin authorization and rejects a foreign origin", async () => {
    const response = await PATCH(new Request("https://example.test/api/admin/products/stock", { method: "PATCH", headers: { origin: "https://foreign.test", host: "example.test" }, body: JSON.stringify({ updates }) }));
    expect(response.status).toBe(401);
  });
});
