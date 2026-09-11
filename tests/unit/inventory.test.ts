import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleAdminDataRepository } from "@/application/admin/data";
import { inventoryConsumption } from "@/infrastructure/google/repositories";
import { SaleService } from "@/application/sales/service";
import { productInputSchema } from "@/domain/validation";
import { updateCartItem } from "@/components/child/cart-storage";

afterEach(() => vi.restoreAllMocks());
describe("inventory", () => {
  it("deduplicates sales, reserves pending items, restores voids and counts rewards", async () => {
    vi.spyOn(GoogleAdminDataRepository.prototype, "listSales").mockResolvedValue([
      { saleId: "s1", saleStatus: "completed", writeStatus: "completed" },
      { saleId: "s2", saleStatus: "voided" },
      { saleId: "s3", saleStatus: "completed", writeStatus: "pending" },
    ] as never);
    vi.spyOn(GoogleAdminDataRepository.prototype, "listSaleItems").mockResolvedValue([
      { saleItemId: "i1", saleId: "s1", productId: "p", quantity: 2 },
      { saleItemId: "i1", saleId: "s1", productId: "p", quantity: 2 },
      { saleItemId: "i2", saleId: "s2", productId: "p", quantity: 10 },
      { saleItemId: "i3", saleId: "s3", productId: "p", quantity: 1 },
    ] as never);
    vi.spyOn(GoogleAdminDataRepository.prototype, "listRewards").mockResolvedValue([
      { redemptionId: "r1", productId: "p", quantity: 1, status: "completed" },
      { redemptionId: "r2", productId: "p", quantity: 5, status: "voided" },
    ] as never);
    expect((await inventoryConsumption({} as never)).get("p")).toBe(4);
  });
  it("rejects combined duplicate lines exceeding stock before writing sales", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const appendPending = vi.fn();
    const service = new SaleService({
      products: { listAll: async () => [{ productId: id, stockQuantity: 1, status: "active" }] } as never,
      sales: { findByRequestId: async () => null, appendPending } as never,
    });
    await expect(service.create({ requestId: id, paymentMethod: "cash", items: [{ productId: id, quantity: 1 }, { productId: id, quantity: 1 }] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(appendPending).not.toHaveBeenCalled();
  });
  it("caps the cart at available stock and removes sold-out products", () => {
    const product = { productId: "p", name: "おかし", priceYen: 10, fallbackEmoji: "🍬", stockQuantity: 2 };
    const cart = updateCartItem({ requestId: "r", items: [] }, product, 5);
    expect(cart.items[0].quantity).toBe(2);
    expect(updateCartItem(cart, { ...product, stockQuantity: 0 }, 1).items).toEqual([]);
  });
  it("validates non-negative whole inventory counts", () => {
    const input = { name: "おかし", priceYen: 10, fallbackEmoji: "🍬", displayOrder: 1, status: "active" };
    for (const stockQuantity of [-1, 1.5, 1000000]) expect(productInputSchema.safeParse({ ...input, stockQuantity }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...input, stockQuantity: 0 }).success).toBe(true);
  });
});
