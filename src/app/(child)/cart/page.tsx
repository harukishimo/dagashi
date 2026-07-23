"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChildHeader } from "@/components/child/ChildHeader";
import { ProductVisual } from "@/components/child/ProductVisual";
import { QuantityStepper } from "@/components/child/QuantityStepper";
import { cartItemsFromStored, cartTotal, createRequestId, readCart, updateCartItem, writeCart } from "@/components/child/cart-storage";
import type { CartItem, StoredCart } from "@/components/child/types";
import styles from "@/components/child/child-ui.module.css";

export default function CartPage(): React.JSX.Element {
  const [cart, setCart] = useState<StoredCart | null>(null);
  useEffect(() => setCart(readCart()), []);
  const items = useMemo(() => cartItemsFromStored(cart), [cart]);
  const total = cartTotal(items);

  const changeQuantity = (item: CartItem, quantity: number) => {
    const current = cart ?? { requestId: createRequestId(), items: [] };
    const next = updateCartItem(current, item.product, quantity);
    setCart(next);
    writeCart(next);
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <ChildHeader currentStep="cart" />
        <section aria-labelledby="cart-title">
          <h1 id="cart-title" className={styles.title}>かごを かくにんしよう</h1>
          <p className={styles.subtitle}>ほしいものと ねだんを みてみよう。</p>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <p>かごに おかしが ありません。<br /><Link className={styles.subtleLink} href="/shop">おかしを えらぶ</Link></p>
            </div>
          ) : (
            <div className={styles.cartItems}>
              {items.map((item) => (
                <article className={styles.cartLine} key={item.productId}>
                  <ProductVisual product={item.product} />
                  <div className={styles.lineMeta}>
                    <h2 className={styles.productName}>{item.product.name}</h2>
                    <p className={styles.linePrice}>{item.product.priceYen.toLocaleString("ja-JP")}円 × {item.quantity}こ</p>
                    <QuantityStepper productName={item.product.name} value={item.quantity} onChange={(quantity) => changeQuantity(item, quantity)} />
                  </div>
                  <p className={styles.lineSubtotal}>{(item.product.priceYen * item.quantity).toLocaleString("ja-JP")}円</p>
                </article>
              ))}
              <aside className={styles.summaryCard} aria-label="おかいけいの合計">
                <div className={styles.summaryRow}><span>ぜんぶで</span><strong className={styles.summaryTotal}>{total.toLocaleString("ja-JP")}円</strong></div>
                <div className={styles.actions}>
                  <Link className={styles.secondaryButton} href="/shop">おかしを えらびなおす</Link>
                  <Link className={styles.primaryButton} href="/checkout">これで買う</Link>
                </div>
              </aside>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
