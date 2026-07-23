"use client";

import { useEffect, useState } from "react";

import styles from "@/components/admin/admin.module.css";
import type { ProductSalesRow } from "@/application/admin/service";

export default function ProductSalesPage() {
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const [rows, setRows] = useState<ProductSalesRow[]>([]); const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/admin/sales/products?startDate=${today}&endDate=${today}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "読込に失敗しました"); setRows(payload.data.rows as ProductSalesRow[]); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")); }, [today]);
  return <><header className={styles.header}><h1>商品別売上</h1><span>{today}</span></header>{error && <p className={styles.error}>{error}</p>}<section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>商品名</th><th>状態</th><th>販売個数</th><th>売上額</th><th>特典交換数</th></tr></thead><tbody>{rows.map((row) => <tr key={row.productId}><td>{row.name}<br /><small>{row.category}</small></td><td>{row.status}</td><td>{row.quantity}</td><td>{row.totalYen.toLocaleString()}円</td><td>{row.rewardQuantity}</td></tr>)}</tbody></table></div></section></>;
}
