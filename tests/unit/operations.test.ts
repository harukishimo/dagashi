import { describe, expect, it, vi } from "vitest";
import { selectProducts } from "@/domain/product-list";
import { parseOperationSettings } from "@/domain/operation-settings";
import { customerSurveySummary } from "@/domain/customer-survey";
import { saleRow, toSale, GoogleSheetsSaleRepository } from "@/infrastructure/google/sales-repositories";
import { GoogleAdminDataRepository } from "@/application/admin/data";
import { SHEET_HEADERS } from "@/infrastructure/google/repositories";
import { AdminSettingsService, filterAdminSettings, validateAdminSettingValue } from "@/application/admin/settings-service";
import type { Sale } from "@/domain/types";

const products = [
  { productId: "a", name: "チョコ A", priceYen: 30, status: "active" as const, displayOrder: 2, updatedAt: "2026-01-01" },
  { productId: "b", name: "チョコB", priceYen: 10, status: "sold_out" as const, displayOrder: 1, updatedAt: "2026-01-02" },
  { productId: "c", name: "グミ", priceYen: 10, status: "draft" as const, displayOrder: 3, updatedAt: "2026-01-03" },
];
const options = { query: "", price: "", statuses: [], sort: "price_asc" as const };
const sale: Sale = { saleId: "11111111-1111-4111-8111-111111111111", requestId: "22222222-2222-4222-8222-222222222222", soldAt: "2026-11-05T01:00:00Z", writeStatus: "completed", saleStatus: "completed", totalYen: 30, paymentMethod: "cash", experienceStatus: "skipped", elapsedMs: null, challengeSuccess: false, stampCount: 1, voidedAt: null, voidReason: null, createdAt: "2026-11-05T01:00:00Z", updatedAt: "2026-11-05T01:00:00Z", customerType: "family" };

describe("product master filters", () => {
  it("combines normalized partial name, exact price and multiple statuses", () => {
    expect(selectProducts(products, { ...options, query: "ちょこａ", price: "30", statuses: ["active", "sold_out"] }).map(p => p.productId)).toEqual(["a"]);
    expect(selectProducts(products, { ...options, query: "ちょこ", price: "10", statuses: ["active", "sold_out"] }).map(p => p.productId)).toEqual(["b"]);
    expect(selectProducts(products, { ...options, price: "10", statuses: ["active"] })).toEqual([]);
  });
  it("sorts prices numerically and display order independently without mutating source", () => {
    expect(selectProducts(products, options).map(p => p.productId)).toEqual(["b", "c", "a"]);
    expect(selectProducts(products, { ...options, sort: "display_order" }).map(p => p.productId)).toEqual(["b", "a", "c"]);
    expect(products.map(p => p.productId)).toEqual(["a", "b", "c"]);
  });
});

describe("operation settings", () => {
  it("accepts price groups and normalizes the previous group setting", () => {
    expect(validateAdminSettingValue("shop_display_mode", "price")).toBe("price");
    expect(parseOperationSettings([{ key: "shop_display_mode", value: "price", updatedAt: "" }]).shopDisplayMode).toBe("price");
    expect(parseOperationSettings([{ key: "shop_display_mode", value: "category", updatedAt: "" }]).shopDisplayMode).toBe("price");
    expect(filterAdminSettings([{ key: "shop_display_mode", value: "category", updatedAt: "" }])).toEqual({ shop_display_mode: "price" });
  });
  it("defaults PIN on and survey off for older sheets", () => {
    expect(parseOperationSettings([])).toMatchObject({ checkoutPinRequired: true, customerSurveyEnabled: false, shopDisplayMode: "flat" });
    expect(() => parseOperationSettings([{ key: "checkout_pin_required", value: "off", updatedAt: "" }])).toThrow();
    expect(() => parseOperationSettings([true, false].map(value => ({ key: "checkout_pin_required", value: String(value), updatedAt: "" })))).toThrow();
  });
  it("only saves an allowlisted existing row and records audit", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [[...SHEET_HEADERS.settings], ["checkout_pin_required", "true", "now"]] })), updateValues: vi.fn(), appendValues: vi.fn() };
    const service = new AdminSettingsService(client as never);
    expect((await service.update({ checkout_pin_required: false })).checkout_pin_required).toBe("false");
    expect(client.updateValues).toHaveBeenCalledWith("settings!A2:C2", [["checkout_pin_required", "false", expect.any(String)]]);
    await expect(service.update({ shop_display_mode: "bad" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(service.update({ ADMIN_PIN_HASH: "new" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("customer survey storage", () => {
  it("reads legacy as unregistered and roundtrips new answers", () => {
    expect(toSale(saleRow(sale), 2).customerType).toBe("family");
    expect(toSale(saleRow(sale).slice(0, 15), 2).customerType).toBe("unregistered");
    const invalid = saleRow(sale); invalid[17] = "anything";
    expect(() => toSale(invalid, 2)).toThrow();
  });
  it("preserves answers when challenge or void updates a sale", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [[...SHEET_HEADERS.sales, "event_id", "event_name_snapshot", "customer_type"], saleRow(sale)] })), updateValues: vi.fn() };
    const updated = { ...sale, saleStatus: "voided" as const };
    await new GoogleSheetsSaleRepository(client as never).update(updated);
    expect(client.updateValues).toHaveBeenLastCalledWith("sales!A2:R2", [saleRow(updated)]);
    await new GoogleAdminDataRepository(client as never).updateSale(updated);
    expect(client.updateValues).toHaveBeenLastCalledWith("sales!A2:R2", [saleRow(updated)]);
  });
  it("counts only confirmed, nonvoid sales once, including unregistered", () => {
    const summary = customerSurveySummary([sale, sale, { ...sale, saleId: "old", customerType: undefined }, { ...sale, saleId: "void", saleStatus: "voided" }, { ...sale, saleId: "pending", writeStatus: "pending" }]);
    expect(summary.find(row => row.type === "family")).toMatchObject({ count: 1, ratio: 50, totalYen: 30 });
    expect(summary.find(row => row.type === "unregistered")?.count).toBe(1);
    expect(customerSurveySummary([]).every(row => row.ratio === 0)).toBe(true);
  });
});
