"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChildHeader } from "@/components/child/ChildHeader";
import { cartItemsFromStored, cartTotal, clearCart, readCart } from "@/components/child/cart-storage";
import { AsyncButton } from "@/components/common/AsyncButton";
import { InlineError } from "@/components/common/InlineError";
import styles from "@/components/child/child-ui.module.css";

export default function CheckoutPage(): React.JSX.Element {
  const router = useRouter();
  const cart = useMemo(() => readCart(), []);
  const items = useMemo(() => cartItemsFromStored(cart), [cart]);
  const total = cartTotal(items);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "other">("cash");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [pin, setPin] = useState("");

  const continueAfterSale = (sale: { saleId: string; experienceStatus?: string }) => {
    if (sale.experienceStatus === "skipped") {
      clearCart();
      router.replace("/");
    } else {
      window.location.assign(`/challenge/${encodeURIComponent(sale.saleId)}`);
    }
  };

  const lookupExistingSale = async (): Promise<boolean> => {
    if (!cart) return false;
    try {
      const response = await fetch(`/api/sales/by-request/${encodeURIComponent(cart.requestId)}`, { headers: { Origin: window.location.origin }, cache: "no-store" });
      const body = (await response.json()) as { data?: { saleId?: string; writeStatus?: string; experienceStatus?: string } | null };
      if (response.ok && body.data?.saleId && body.data.writeStatus === "completed") {
        continueAfterSale({ ...body.data, saleId: body.data.saleId });
        return true;
      }
    } catch {
      // The error shown below tells staff not to create a new transaction.
    }
    return false;
  };

  const confirmPayment = async () => {
    if (!cart || items.length === 0) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/sales", { method: "POST", headers: { "content-type": "application/json", Origin: window.location.origin }, body: JSON.stringify({ requestId: cart.requestId, paymentMethod, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })) }) });
      const body = (await response.json()) as { data?: { saleId?: string; writeStatus?: string; experienceStatus?: string }; error?: { message?: string } };
      if (response.status === 401) {
        setAuthRequired(true);
        setPending(false);
        return;
      }
      if (!response.ok || !body.data?.saleId || body.data.writeStatus !== "completed") throw new Error(body.error?.message ?? "売上を保存できませんでした");
      continueAfterSale({ ...body.data, saleId: body.data.saleId });
    } catch (cause) {
      if (await lookupExistingSale()) return;
      setError(cause instanceof Error ? cause.message : "売上を保存できませんでした。お店の人に画面を見せてね。");
    } finally {
      setPending(false);
    }
  };

  const loginAndConfirm = async () => {
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PINは4〜8桁の数字で入力してください");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json", Origin: window.location.origin }, body: JSON.stringify({ pin }) });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "PINを確認できませんでした");
      setAuthRequired(false);
      setPin("");
      await confirmPayment();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PINを確認できませんでした");
      setPending(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <ChildHeader currentStep="checkout" />
        <section aria-labelledby="checkout-title">
          <h1 id="checkout-title" className={styles.title}>お店の人に 画面とおかしを みせてね</h1>
          <p className={styles.subtitle}>お店の人が おかねを うけとってから、売上を保存します。</p>
          {error && <InlineError>{error}<br />同じ画面から再試行できます。</InlineError>}
          {items.length === 0 ? (
            <div className={styles.empty}><p>かごに おかしが ありません。<br /><Link className={styles.subtleLink} href="/shop">おかしを えらぶ</Link></p></div>
          ) : (
            <div className={styles.summaryCard}>
              {items.map((item) => <div className={styles.summaryRow} key={item.productId}><span>{item.product.name} × {item.quantity}こ</span><strong>{(item.product.priceYen * item.quantity).toLocaleString("ja-JP")}円</strong></div>)}
              <div className={styles.summaryRow}><span>おしはらい</span><strong className={styles.summaryTotal}>{total.toLocaleString("ja-JP")}円</strong></div>
              <fieldset>
                <legend>おしはらいの方法（お店の人がえらぶ）</legend>
                <label><input type="radio" name="payment-method" value="cash" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} /> 現金</label>
                <label><input type="radio" name="payment-method" value="other" checked={paymentMethod === "other"} onChange={() => setPaymentMethod("other")} /> その他</label>
              </fieldset>
              {authRequired && (
                <div className={styles.infoBox}>
                  <h2>お店の人のそうさ</h2>
                  <label htmlFor="checkout-pin">PIN（4〜8けた）</label>
                  <input id="checkout-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} />
                  <AsyncButton className={styles.primaryButton} type="button" pending={pending} pendingLabel="確認しています…" onClick={() => void loginAndConfirm()}>PINを確認して支払済みにする</AsyncButton>
                </div>
              )}
              <div className={styles.actions}>
                <Link className={styles.secondaryButton} href="/cart">かごを えらびなおす</Link>
                <AsyncButton className={styles.primaryButton} type="button" pending={pending} disabled={authRequired} pendingLabel="売上を保存しています…" onClick={() => void confirmPayment()}>支払済みにする</AsyncButton>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
