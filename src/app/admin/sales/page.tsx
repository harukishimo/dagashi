"use client";
import { useEffect, useState } from "react";
import styles from "@/components/admin/admin.module.css";
import type { SalesEvent } from "@/domain/types";
import { buildSalesBreakdown, uniqueSaleItems, type SaleWithItems } from "@/domain/sales-breakdown";
import salesStyles from "./sales.module.css";
export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [events, setEvents] = useState<SalesEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [manualEntryUrl, setManualEntryUrl] = useState("");
  useEffect(() => {
    setEventId(new URLSearchParams(window.location.search).get("eventId") || "");
    Promise.all([fetch("/api/admin/sales"), fetch("/api/admin/events")]).then(async ([response, eventResponse]) => {
      const payload = await response.json(); const eventPayload = await eventResponse.json();
      if (!response.ok || !eventResponse.ok) throw new Error(payload.error?.message || eventPayload.error?.message || "読込に失敗しました");
      setSales(payload.data.sales); setEvents(eventPayload.data.events);
      setManualEntryUrl(payload.data.manualEntryUrl || "");
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")).finally(() => setLoading(false));
  }, []);
  const visible = sales.filter((sale) => !eventId || (eventId === "none" ? !sale.eventId : sale.eventId === eventId));
  const breakdown = buildSalesBreakdown(visible);
  return <><header className={styles.header}><h1>取引履歴・詳細</h1></header>
    {manualEntryUrl && <p><a href={manualEntryUrl} target="_blank" rel="noreferrer">手入力売上シートを開く</a></p>}
    <p>手入力売上の「確定」行も合算しています。手入力は1行＝1商品明細として件数に含みます。修正・取消は手入力売上シートで行い、この画面を再読み込みしてください。</p>
    <label className={styles.label} htmlFor="sales-event-filter">イベント</label>
    <select id="sales-event-filter" className={styles.select} value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">すべて</option><option value="none">イベント未設定</option>{events.map((event) => <option key={event.eventId} value={event.eventId}>{event.name}</option>)}</select>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && <section className={styles.panel} aria-labelledby="product-breakdown-title">
      <h2 id="product-breakdown-title">商品別の売上内訳</h2>
      <p>選択中のイベントの確定売上を集計します。取消・保存中・保存エラーの取引は含みません。</p>
      <div className={salesStyles.summary}>
        <div className={salesStyles.metric}>確定取引<strong>{breakdown.saleCount.toLocaleString()}件</strong></div>
        <div className={salesStyles.metric}>販売数量<strong>{breakdown.totalQuantity.toLocaleString()}個</strong></div>
        <div className={salesStyles.metric}>商品売上合計<strong>{breakdown.totalYen.toLocaleString()}円</strong></div>
      </div>
      {breakdown.products.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>商品名（販売時）</th><th>販売数量</th><th>売上金額</th><th>金額構成率</th><th>数量構成率</th></tr></thead>
        <tbody>{breakdown.products.map((product) => <tr key={product.productId}>
          <td><strong>{product.names.join(" / ")}</strong>{product.names.length > 1 && <small className={salesStyles.detail}>同じ商品IDの販売時名称をまとめています</small>}</td>
          <td>{product.quantity.toLocaleString()}個</td><td>{product.amountYen.toLocaleString()}円</td>
          <td className={salesStyles.ratio}>{product.amountRatio.toFixed(1)}%<meter className={salesStyles.bar} min={0} max={100} value={product.amountRatio} aria-label={`${product.names[0]}の金額構成率`} /></td>
          <td className={salesStyles.ratio}>{product.quantityRatio.toFixed(1)}%<meter className={salesStyles.bar} min={0} max={100} value={product.quantityRatio} aria-label={`${product.names[0]}の数量構成率`} /></td>
        </tr>)}</tbody>
      </table></div> : <p>集計対象の商品売上はありません。</p>}
      <p className={salesStyles.detail}>金額構成率＝商品売上金額÷集計対象の商品売上合計、数量構成率＝商品販売数量÷集計対象の販売数量。小数第1位に丸めるため合計が100%にならない場合があります。</p>
    </section>}
    <section className={styles.panel}><h2>取引一覧</h2>{loading ? <p>読み込み中…</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>日時（日本時間）</th><th>イベント</th><th>購入商品（販売時）</th><th>取引ID</th><th>状態</th><th>商品数</th><th>合計</th><th>支払方法</th><th>取消</th></tr></thead><tbody>{visible.map((sale) => <tr key={sale.saleId}><td>{new Date(sale.soldAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td><td>{sale.eventNameSnapshot || "未設定"}</td><td>{sale.items.length ? <ul className={salesStyles.items}>{uniqueSaleItems(sale.items).map((item) => <li key={item.saleItemId}><strong>{item.productNameSnapshot || "商品名未記録"}</strong><span className={salesStyles.detail}>{item.unitPriceYen.toLocaleString()}円 × {item.quantity}個 = {item.lineTotalYen.toLocaleString()}円</span></li>)}</ul> : "商品明細なし"}</td><td className={salesStyles.id}>{sale.source === "manual" && <strong>手入力<br /></strong>}{sale.saleId}</td><td>{sale.saleStatus === "voided" ? "取消" : ({ completed: "確定", pending: "保存中", error: "保存エラー" }[sale.writeStatus])}</td><td>{uniqueSaleItems(sale.items).reduce((sum, item) => sum + item.quantity, 0)}</td><td>{sale.totalYen.toLocaleString()}円</td><td>{sale.paymentMethod === "cash" ? "現金" : "その他"}</td><td>{sale.source === "manual" ? "シートで取消" : sale.saleStatus === "completed" && sale.writeStatus === "completed" ? <a href={`/admin/sales/${sale.saleId}/void`}>取消</a> : "—"}</td></tr>)}</tbody></table>{visible.length === 0 && <p>該当する取引はありません。</p>}</div>}</section>
  </>;
}
