import type { CartItem, ChildProduct, StoredCart } from "./types";

export const CART_STORAGE_KEY = "dagashi:cart:v1";
export const MAX_PRODUCT_QUANTITY = 20;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readCart(): StoredCart | null {
  if (!canUseStorage()) return null;
  const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<StoredCart>;
    if (typeof value.requestId !== "string" || !Array.isArray(value.items)) return null;
    return {
      requestId: value.requestId,
      items: value.items.filter((item): item is StoredCart["items"][number] => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return (
          typeof candidate.productId === "string" &&
          Number.isInteger(candidate.quantity) &&
          Number(candidate.quantity) >= 0 &&
          Boolean(candidate.product)
        );
      }),
    };
  } catch {
    return null;
  }
}

export function writeCart(cart: StoredCart): void {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function clearCart(): void {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(CART_STORAGE_KEY);
}

export function cartItemsFromStored(cart: StoredCart | null): CartItem[] {
  return cart?.items.map((item) => ({ ...item, product: item.product })) ?? [];
}

export function updateCartItem(
  cart: StoredCart,
  product: ChildProduct,
  requestedQuantity: number,
): StoredCart {
  const limit = product.status === "sold_out" ? 0 : product.stockQuantity ?? MAX_PRODUCT_QUANTITY;
  const quantity = Math.max(0, Math.min(MAX_PRODUCT_QUANTITY, limit, Math.trunc(requestedQuantity)));
  const current = cart.items.filter((item) => item.productId !== product.productId);
  if (quantity > 0) {
    current.push({ productId: product.productId, quantity, product });
  }
  return { ...cart, items: current };
}

export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.priceYen * item.quantity, 0);
}

export function cartCount(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
