"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChildHeader } from "@/components/child/ChildHeader";
import { createRequestId, writeCart } from "@/components/child/cart-storage";
import { fetchProducts } from "@/components/child/product-api";
import { InlineError } from "@/components/common/InlineError";
import styles from "@/components/child/child-ui.module.css";

export default function ChildStartPage(): React.JSX.Element {
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = async (signal?: AbortSignal) => {
    setState("loading");
    setMessage("");
    try {
      const products = await fetchProducts(signal);
      if (products.length === 0) {
        setState("empty");
        return;
      }
      setState("ready");
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

  const start = () => {
    writeCart({ requestId: createRequestId(), items: [] });
  };

  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <ChildHeader />
        <section className={styles.hero} aria-labelledby="start-title">
          <div>
            <div className={styles.heroArt} aria-hidden="true">🍭</div>
            <h1 id="start-title" className={styles.heroTitle}>じぶんで えらんでみよう！</h1>
            <p className={styles.subtitle}>すきなおかしをえらんで、かごにいれてみよう。</p>
            {state === "loading" && <p className={styles.infoBox} role="status">おみせを じゅんびしています…</p>}
            {state === "empty" && <p className={styles.infoBox} role="status">いまは じゅんびちゅうです。お店の人をよんでね。</p>}
            {state === "error" && (
              <>
                <InlineError>{message || "商品を読み込めませんでした。"}<br />お店の人をよんで、もういちど読みこんでね。</InlineError>
                <button type="button" className={styles.secondaryButton} onClick={() => void load()}>もういちど読みこむ</button>
              </>
            )}
            <div className={styles.heroActions}>
              {state === "ready" && <Link href="/shop" onClick={start} className={styles.primaryButton}>おかいものを はじめる</Link>}
            </div>
            <p className={styles.staffLink}><Link className={styles.subtleLink} href="/admin/login">スタッフ・アドミン</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
