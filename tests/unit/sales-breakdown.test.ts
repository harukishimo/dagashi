import { describe, expect, it } from "vitest";
import { buildSalesBreakdown, uniqueSaleItems, type SaleWithItems } from "@/domain/sales-breakdown";
import type { SaleItem } from "@/domain/types";

const item: SaleItem = { saleItemId: "i1", saleId: "s1", productId: "p1", productNameSnapshot: "昔の名前", quantity: 2, unitPriceYen: 50, lineTotalYen: 100, createdAt: "2026-09-18T00:00:00Z" };
const sale: SaleWithItems = { saleId: "s1", requestId: "r1", soldAt: item.createdAt, writeStatus: "completed", saleStatus: "completed", totalYen: 100, paymentMethod: "cash", experienceStatus: "skipped", elapsedMs: null, challengeSuccess: false, stampCount: 1, voidedAt: null, voidReason: null, createdAt: item.createdAt, updatedAt: item.createdAt, items: [item] };

describe("sales product breakdown", () => {
  it("groups by product ID and retains distinct historical names and sale prices", () => {
    const result = buildSalesBreakdown([{ ...sale, items: [item, { ...item, saleItemId: "i2", productNameSnapshot: "新しい名前", quantity: 1, unitPriceYen: 200, lineTotalYen: 200 }, { ...item, saleItemId: "i3", productId: "p2", productNameSnapshot: "別商品", quantity: 1, lineTotalYen: 100 }] }]);
    expect(result).toMatchObject({ saleCount: 1, totalYen: 400, totalQuantity: 4 });
    expect(result.products[0]).toMatchObject({ productId: "p1", names: ["昔の名前", "新しい名前"], amountYen: 300, quantity: 3, amountRatio: 75, quantityRatio: 75 });
  });
  it("excludes voided, pending and error sales", () => {
    expect(buildSalesBreakdown([{ ...sale, saleStatus: "voided" }, { ...sale, writeStatus: "pending" }, { ...sale, writeStatus: "error" }])).toEqual({ saleCount: 0, totalYen: 0, totalQuantity: 0, products: [] });
  });
  it("does not double count repeated sale or line IDs, nor mismatched lines", () => {
    const duplicated = { ...sale, items: [item, item, { ...item, saleItemId: "wrong", saleId: "other" }] };
    expect(buildSalesBreakdown([duplicated, duplicated])).toMatchObject({ saleCount: 1, totalYen: 100, totalQuantity: 2 });
    expect(uniqueSaleItems([item, item])).toHaveLength(1);
  });
  it("handles empty and zero-priced sales without NaN or Infinity", () => {
    expect(buildSalesBreakdown([]).products).toEqual([]);
    const result = buildSalesBreakdown([{ ...sale, items: [{ ...item, unitPriceYen: 0, lineTotalYen: 0 }] }]);
    expect(result.products[0].amountRatio).toBe(0);
    expect(result.products[0].quantityRatio).toBe(100);
  });
});
