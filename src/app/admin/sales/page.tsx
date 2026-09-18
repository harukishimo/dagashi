"use client";
import { useEffect, useState } from "react";
import styles from "@/components/admin/admin.module.css";
import type { Sale, SaleItem, SalesEvent } from "@/domain/types";
type SaleWithItems = Sale & { items: SaleItem[] };
export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [events, setEvents] = useState<SalesEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setEventId(new URLSearchParams(window.location.search).get("eventId") || "");
    Promise.all([fetch("/api/admin/sales"), fetch("/api/admin/events")]).then(async ([response, eventResponse]) => {
      const payload = await response.json(); const eventPayload = await eventResponse.json();
      if (!response.ok || !eventResponse.ok) throw new Error(payload.error?.message || eventPayload.error?.message || "読込に失敗しました");
      setSales(payload.data.sales); setEvents(eventPayload.data.events);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")).finally(() => setLoading(false));
  }, []);
  const visible = sales.filter((sale) => !eventId || (eventId === "none" ? !sale.eventId : sale.eventId === eventId));
  return <><header className={styles.header}><h1>取引履歴・詳細</h1></header>
    <label className={styles.label} htmlFor="sales-event-filter">イベント</label>
    <select id="sales-event-filter" className={styles.select} value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">すべて</option><option value="none">イベント未設定</option>{events.map((event) => <option key={event.eventId} value={event.eventId}>{event.name}</option>)}</select>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.panel}>{loading ? <p>読み込み中…</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>日時（日本時間）</th><th>イベント</th><th>取引ID</th><th>状態</th><th>商品数</th><th>合計</th><th>支払方法</th><th>取消</th></tr></thead><tbody>{visible.map((sale) => <tr key={sale.saleId}><td>{new Date(sale.soldAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td><td>{sale.eventNameSnapshot || "未設定"}</td><td>{sale.saleId}</td><td>{sale.saleStatus === "voided" ? "取消" : sale.writeStatus}</td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>{sale.totalYen.toLocaleString()}円</td><td>{sale.paymentMethod === "cash" ? "現金" : "その他"}</td><td>{sale.saleStatus === "completed" && sale.writeStatus === "completed" ? <a href={`/admin/sales/${sale.saleId}/void`}>取消</a> : "—"}</td></tr>)}</tbody></table>{visible.length === 0 && <p>該当する取引はありません。</p>}</div>}</section>
  </>;
}
