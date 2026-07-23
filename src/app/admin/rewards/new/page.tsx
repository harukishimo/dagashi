"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import styles from "@/components/admin/admin.module.css";
import type { Product } from "@/domain/types";

export default function RewardPage() {
  const [products, setProducts] = useState<Product[]>([]); const [productId, setProductId] = useState(""); const [confirmed, setConfirmed] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => { fetch("/api/admin/products").then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "読込に失敗しました"); setProducts(payload.products as Product[]); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); setMessage(""); try { const response = await fetch("/api/admin/rewards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, quantity: 1, cardConfirmed: confirmed }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "交換登録に失敗しました"); setMessage("特典交換を記録しました（0円）"); setConfirmed(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "交換登録に失敗しました"); } finally { setPending(false); } }
  return <><header className={styles.header}><h1>特典交換</h1></header>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.notice} role="status">{message}</p>}<section className={styles.panel}><p>紙カードの15マスを現物確認してから登録してください。</p><form className={styles.form} onSubmit={submit}><label className={styles.label}>交換する商品<select className={styles.select} required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">選択してください</option>{products.filter((product) => product.status !== "hidden").map((product) => <option value={product.productId} key={product.productId}>{product.name}（通常{product.priceYen.toLocaleString()}円）</option>)}</select></label><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 紙カード15個確認済み</label><button className={styles.button} type="submit" disabled={pending || !confirmed}>{pending ? "登録中…" : "特典交換を登録"}</button></form></section></>;
}
