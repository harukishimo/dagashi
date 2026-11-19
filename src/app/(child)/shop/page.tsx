"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CustomerSurvey } from "@/components/child/CustomerSurvey";
import { PriceNavigation } from "@/components/child/PriceNavigation";
import type { CustomerType } from "@/domain/customer-survey";
import { ChildHeader } from "@/components/child/ChildHeader";
import { CartTotalBar } from "@/components/child/CartTotalBar";
import { cartCount, cartItemsFromStored, cartTotal, createRequestId, readCart, updateCartItem, writeCart } from "@/components/child/cart-storage";
import { fetchProductCatalog } from "@/components/child/product-api";
import { ProductCard } from "@/components/child/ProductCard";
import type { ChildProduct, StoredCart } from "@/components/child/types";
import { InlineError } from "@/components/common/InlineError";
import styles from "@/components/child/child-ui.module.css";

export default function ShopPage(): React.JSX.Element {
  const [products, setProducts] = useState<ChildProduct[]>([]);
  const [cart, setCart] = useState<StoredCart | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("");
  const [displayMode, setDisplayMode] = useState<"flat" | "price">("flat");
  const [surveyEnabled, setSurveyEnabled] = useState(false);
  const [activePrice, setActivePrice] = useState<number | null>(null);
  const groupElements = useRef(new Map<number, HTMLElement>());
  const pageElement = useRef<HTMLElement>(null);
  const surveyBar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = surveyBar.current;
    const page = pageElement.current;
    if (!bar || !page) return;
    const measure = () => page.style.setProperty("--shop-survey-height", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => { observer.disconnect(); page.style.removeProperty("--shop-survey-height"); };
  }, [surveyEnabled, state]);

  const load = async (signal?: AbortSignal) => {
    setState("loading");
    try {
      const catalog = await fetchProductCatalog(signal);
      const nextProducts = catalog.products;
      setDisplayMode(catalog.displayMode);
      setSurveyEnabled(catalog.surveyEnabled);
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
  const groups = useMemo(() => {
    const result = new Map<number, ChildProduct[]>();
    for (const product of products) {
      const group = result.get(product.priceYen) ?? [];
      group.push(product);
      result.set(product.priceYen, group);
    }
    return [...result.entries()].sort(([a], [b]) => a - b);
  }, [products]);
  const prices = useMemo(() => groups.map(([price]) => price), [groups]);
  useEffect(() => {
    if (displayMode !== "price" || !prices.length) return;
    let frame = 0;
    const updateActive = () => {
      frame = 0;
      const marker = Math.max(Math.min(180, window.innerHeight * .22), (surveyBar.current?.getBoundingClientRect().bottom ?? 0) + 16);
      let current = prices[0];
      for (const price of prices) {
        if ((groupElements.current.get(price)?.getBoundingClientRect().top ?? Infinity) <= marker) current = price;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) current = prices[prices.length - 1];
      setActivePrice(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(updateActive); };
    updateActive();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [displayMode, prices]);

  const selectPrice = (price: number) => {
    const element = groupElements.current.get(price);
    element?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    element?.focus({ preventScroll: true });
  };

  const changeCustomerType = (customerType: CustomerType) => {
    const next = { ...(cart ?? { requestId: createRequestId(), items: [] }), customerType };
    setCart(next); writeCart(next);
  };
  const productGrid = (list: ChildProduct[]) => <div className={styles.grid} aria-label="販売中のおかし">{list.map(product => <ProductCard key={product.productId} product={product} quantity={quantities.get(product.productId) ?? 0} onQuantityChange={quantity => changeQuantity(product, quantity)} />)}</div>;

  const changeQuantity = (product: ChildProduct, quantity: number) => {
    const current = cart ?? { requestId: createRequestId(), items: [] };
    const next = updateCartItem(current, product, quantity);
    setCart(next);
    writeCart(next);
  };

  return (
    <main ref={pageElement} className={`${styles.page} ${styles.shopPage} ${surveyEnabled && state === "ready" ? styles.shopWithSurvey : ""} ${displayMode === "price" && state === "ready" ? styles.shopWithPriceNav : ""}`}>
      {displayMode === "price" && state === "ready" && <PriceNavigation prices={prices} activePrice={activePrice} onSelect={selectPrice} />}
      <div className={styles.pageInner}>
        <ChildHeader currentStep="choose" />
        {surveyEnabled && state === "ready" && <div ref={surveyBar} className={styles.shopSurveySticky}>
          <CustomerSurvey compact value={cart?.customerType ?? "unregistered"} onChange={changeCustomerType} />
        </div>}
        <section aria-labelledby="shop-title">
          <h1 id="shop-title" className={styles.title}>ほしいおかしを えらんでね</h1>
          <p className={styles.subtitle}>おかしの えか ＋で ふやして、−で へらせるよ。</p>
          {state === "loading" && <p className={styles.infoBox} role="status">おかしを よみこんでいます…</p>}
          {state === "error" && <InlineError>{message}<br />お店の人をよんで、もういちど読みこんでね。</InlineError>}
          {state === "empty" && <div className={styles.empty}><p>いまは えらべる おかしが ありません。<br />お店の人をよんでね。</p></div>}
          {state === "ready" && (
            displayMode === "price" ? <div>{groups.map(([price, list], index) => <section className={styles.productGroup} id={`price-${price}`} ref={element => { if (element) groupElements.current.set(price, element); else groupElements.current.delete(price); }} tabIndex={-1} data-price-tone={index % 5} key={price} aria-label={`${price.toLocaleString("ja-JP")}円のおかし`}><h2 className={styles.groupTitle}><span className={styles.groupPrice}>{price.toLocaleString("ja-JP")}円</span>のおかし</h2>{productGrid(list)}</section>)}</div> : productGrid(products)
          )}
        </section>
      </div>
      <CartTotalBar itemCount={count} totalYen={total} />
    </main>
  );
}
