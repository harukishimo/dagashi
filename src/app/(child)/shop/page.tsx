"use client";

import { useEffect, useMemo, useState } from "react";
import { ChildHeader } from "@/components/child/ChildHeader";
import { CartTotalBar } from "@/components/child/CartTotalBar";
import { cartCount, cartItemsFromStored, cartTotal, createRequestId, readCart, updateCartItem, writeCart } from "@/components/child/cart-storage";
import { fetchProducts } from "@/components/child/product-api";
import { ProductCard } from "@/components/child/ProductCard";
import type { ChildProduct, StoredCart } from "@/components/child/types";
import { InlineError } from "@/components/common/InlineError";
import styles from "@/components/child/child-ui.module.css";

export default function ShopPage(): React.JSX.Element {
  const [products, setProducts] = useState<ChildProduct[]>([]);
  const [cart, setCart] = useState<StoredCart | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = async (signal?: AbortSignal) => {
    setState("loading");
    try {
      const nextProducts = await fetchProducts(signal);
      setProducts(nextProducts);
      if (nextProducts.length === 0) setState("empty");
      else setState("ready");
      setCart((current) => {
        const saved = current ?? readCart() ?? { requestId: createRequestId(), items: [] };
        let next: StoredCart = { ...saved, items: [] };
        for (const item of saved.items) {
          const product = nextProducts.find((candidate) => candidate.productId === item.productId);
          if (product) next = updateCartItem(next, product, item.quantity);
        }
        writeCart(next);
        return next;
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "商品を読み込めませんでした");
      setState("error");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  const items = useMemo(() => cartItemsFromStored(cart), [cart]);
  const quantities = useMemo(() => new Map(items.map((item) => [item.productId, item.quantity])), [items]);
  const total = cartTotal(items);
  const count = cartCount(items);

  const changeQuantity = (product: ChildProduct, quantity: number) => {
    const current = cart ?? { requestId: createRequestId(), items: [] };
    const next = updateCartItem(current, product, quantity);
    setCart(next);
    writeCart(next);
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <ChildHeader currentStep="choose" />
        <section aria-labelledby="shop-title">
          <h1 id="shop-title" className={styles.title}>ほしいおかしを えらんでね</h1>
          <p className={styles.subtitle}>＋と−で かずを かえてみよう。</p>
          {state === "loading" && <p className={styles.infoBox} role="status">おかしを よみこんでいます…</p>}
          {state === "error" && <InlineError>{message}<br />お店の人をよんで、もういちど読みこんでね。</InlineError>}
          {state === "empty" && <div className={styles.empty}><p>いまは えらべる おかしが ありません。<br />お店の人をよんでね。</p></div>}
          {state === "ready" && (
            <div className={styles.grid} aria-label="販売中のおかし">
              {products.map((product) => (
                <ProductCard key={product.productId} product={product} quantity={quantities.get(product.productId) ?? 0} onQuantityChange={(quantity) => changeQuantity(product, quantity)} />
              ))}
            </div>
          )}
        </section>
      </div>
      <CartTotalBar itemCount={count} totalYen={total} />
    </main>
  );
}
