"use client";

import { useEffect, useState } from "react";

import styles from "@/components/admin/admin.module.css";
import type { DashboardResult } from "@/application/admin/service";

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/admin/dashboard?date=${new Intl.DateTimeFormat("en-CA").format(new Date())}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "読込に失敗しました"); setDashboard(payload.dashboard as DashboardResult); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")); }, []);
  return <><header className={styles.header}><h1>ダッシュボード</h1><span>{dashboard?.date ?? "読込中"}</span></header>{error && <p className={styles.error} role="alert">{error}</p>}{dashboard && <><section className={styles.grid} aria-label="当日の集計"><div className={styles.kpi}><span className={styles.kpiLabel}>売上額</span><strong className={styles.kpiValue}>{dashboard.totalYen.toLocaleString()}円</strong></div><div className={styles.kpi}><span className={styles.kpiLabel}>取引件数</span><strong className={styles.kpiValue}>{dashboard.saleCount}</strong></div><div className={styles.kpi}><span className={styles.kpiLabel}>販売個数</span><strong className={styles.kpiValue}>{dashboard.itemCount}</strong></div><div className={styles.kpi}><span className={styles.kpiLabel}>特典交換</span><strong className={styles.kpiValue}>{dashboard.rewardCount}</strong></div><div className={styles.kpi}><span className={styles.kpiLabel}>取消件数</span><strong className={styles.kpiValue}>{dashboard.voidCount}</strong></div><div className={styles.kpi}><span className={styles.kpiLabel}>不完全書込</span><strong className={styles.kpiValue}>{dashboard.incompleteCount}</strong></div></section><section className={styles.panel} style={{ marginTop: 24 }}><h2>最新の取引</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>日時</th><th>取引ID</th><th>状態</th><th>合計</th></tr></thead><tbody>{dashboard.recentSales.map((sale) => <tr key={sale.saleId}><td>{new Date(sale.soldAt).toLocaleString("ja-JP")}</td><td>{sale.saleId}</td><td>{sale.saleStatus === "voided" ? "取消" : sale.writeStatus === "completed" ? "完了" : "未完了"}</td><td>{sale.totalYen.toLocaleString()}円</td></tr>)}</tbody></table></div></section></>}</>;
}
