"use client";

import { useEffect, useState } from "react";

import styles from "@/components/admin/admin.module.css";
import type { Sale, SaleItem } from "@/domain/types";

type SaleWithItems = Sale & { items: SaleItem[] };

export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([]); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/sales").then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "読込に失敗しました"); setSales(payload.data.sales as SaleWithItems[]); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")); }, []);
  return <><header className={styles.header}><h1>取引履歴・詳細</h1></header>{error && <p className={styles.error}>{error}</p>}<section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>日時</th><th>取引ID</th><th>状態</th><th>商品数</th><th>合計</th><th>支払方法</th><th>取消</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.saleId}><td>{new Date(sale.soldAt).toLocaleString("ja-JP")}</td><td>{sale.saleId}</td><td>{sale.saleStatus === "voided" ? "取消" : sale.writeStatus}</td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>{sale.totalYen.toLocaleString()}円</td><td>{sale.paymentMethod === "cash" ? "現金" : "その他"}</td><td>{sale.saleStatus === "completed" && sale.writeStatus === "completed" ? <a href={`/admin/sales/${sale.saleId}/void`}>取消</a> : "—"}</td></tr>)}</tbody></table></div></section></>;
}
