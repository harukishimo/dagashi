import { describe, expect, it } from "vitest";
import { cartCount, cartTotal, updateCartItem } from "@/components/child/cart-storage";
import type { ChildProduct, StoredCart } from "@/components/child/types";

const product: ChildProduct = {
  productId: "test-1",
  name: "[テスト] チョコスナック",
  priceYen: 30,
  category: "チョコ",
  fallbackEmoji: "🍫",
  imageUrl: null,
};

describe("child cart helpers", () => {
  it("adds, caps, and removes product quantities", () => {
    const empty: StoredCart = { requestId: "request-1", items: [] };
    const capped = updateCartItem(empty, product, 99);
    expect(capped.items[0]?.quantity).toBe(20);
    const removed = updateCartItem(capped, product, 0);
    expect(removed.items).toHaveLength(0);
  });

  it("calculates item count and yen total from the snapshot price", () => {
    const cart = updateCartItem({ requestId: "request-1", items: [] }, product, 2);
    const items = cart.items.map((item) => ({ ...item, product: item.product }));
    expect(cartCount(items)).toBe(2);
    expect(cartTotal(items)).toBe(60);
  });
});
