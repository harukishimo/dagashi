"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

import styles from "@/components/admin/admin.module.css";
import type { Sale, SaleItem } from "@/domain/types";

export default function VoidSalePage() {
  const params = useParams<{ saleId: string }>(); const router = useRouter(); const [sale, setSale] = useState<(Sale & { items: SaleItem[] }) | null>(null); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => { fetch(`/api/admin/sales?saleId=${encodeURIComponent(params.saleId)}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "読込に失敗しました"); setSale(payload.data.sales[0] ?? null); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")); }, [params.saleId]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); try { const response = await fetch(`/api/admin/sales/${encodeURIComponent(params.saleId)}/void`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "取消に失敗しました"); router.push("/admin/sales"); } catch (cause) { setError(cause instanceof Error ? cause.message : "取消に失敗しました"); } finally { setPending(false); } }
  return <><header className={styles.header}><h1>売上取消</h1></header>{error && <p className={styles.error} role="alert">{error}</p>}{sale ? <section className={styles.panel}><p>取引ID: {sale.saleId}</p><p>合計: {sale.totalYen.toLocaleString()}円</p><form className={styles.form} onSubmit={submit}><label className={styles.label}>取消理由<textarea className={styles.textarea} required maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className={`${styles.button} ${styles.buttonDanger}`} type="submit" disabled={pending || sale.saleStatus === "voided" || sale.writeStatus !== "completed"}>{pending ? "処理中…" : "この売上を取り消す"}</button></form></section> : <p>読込中…</p>}</>;
}
