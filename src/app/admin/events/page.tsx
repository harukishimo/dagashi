"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { SalesEvent } from "@/domain/types";
import styles from "@/components/admin/admin.module.css";

type EventSummary = SalesEvent & { saleCount: number; totalYen: number };
export default function EventsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/admin/events");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.details?.join(" / ") || payload.error?.message || "読込に失敗しました");
    setEvents(payload.data.events);
  }
  useEffect(() => { load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました")).finally(() => setLoading(false)); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), startDate: data.get("startDate"), endDate: data.get("endDate"), description: data.get("description"), ageRange: data.get("ageRange"), targetAudience: data.get("targetAudience"), expectedAttendance: data.get("expectedAttendance") === "" ? null : Number(data.get("expectedAttendance")) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.details?.join(" / ") || payload.error?.message || "登録に失敗しました。再登録前に一覧を確認してください");
      form.reset(); setMessage("イベントを登録しました"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "通信を確認し、再登録前に一覧を再読み込みしてください"); }
    finally { setBusy(false); }
  }
  async function archive(event: EventSummary) {
    if (!window.confirm(`「${event.name}」を停止しますか？今後の売上は紐づかなくなります。過去の売上・集計は保持されます。`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${event.eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "停止できませんでした");
      setMessage("イベントを停止しました。過去の売上は保持されています。"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "通信エラー。状態を再確認してください"); }
    finally { setBusy(false); }
  }
  return <>
    <header className={styles.header}><h1>イベント・売上</h1></header>
    <p>日本時間の開始日から終了日まで（両日を含む）の新しい売上を自動で紐づけます。過去の売上は変更しません。</p>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <section className={styles.panel}><h2>イベントを作成</h2><form onSubmit={create} className={styles.form}>
      <label className={styles.label}>イベント名<input className={styles.input} name="name" required maxLength={80} /></label>
      <label className={styles.label}>開始日<input className={styles.input} name="startDate" type="date" required /></label>
      <label className={styles.label}>終了日<input className={styles.input} name="endDate" type="date" required /></label>
      <fieldset className={styles.form}><legend>イベント詳細</legend>
        <label className={styles.label}>イベントの内容・目的（任意）<textarea className={styles.textarea} name="description" maxLength={2000} placeholder="例：地域のお祭りで、子どもたちが自分で買い物を体験する出店" /></label>
      </fieldset>
      <fieldset className={styles.form}><legend>ターゲット層</legend>
        <label className={styles.label}>対象年齢層（任意）<input className={styles.input} name="ageRange" maxLength={120} placeholder="例：3〜12歳、未就学児〜小学生" /></label>
        <label className={styles.label}>対象者・ターゲットの特徴（任意）<textarea className={styles.textarea} name="targetAudience" maxLength={500} placeholder="例：近隣の親子連れ、初めてお買い物をする子ども" /></label>
        <label className={styles.label}>想定来場者数（人・任意）<input className={styles.input} name="expectedAttendance" type="number" min={0} max={1000000} step={1} placeholder="例：100" /></label>
        <p>人数はイベント全体の想定人数です。個人情報は入力しないでください。</p>
      </fieldset>
      <p>有効なイベントと重なる期間は登録できません。1名で順番に操作してください。誤登録・重複時は該当イベントを停止し、必要に応じて作り直してください。</p>
      <button className={styles.button} disabled={busy || loading}>{busy ? "登録中…" : "イベントを登録"}</button>
    </form></section>
    <section className={styles.panel}><h2>イベント別売上</h2><p>保存完了した売上のみ集計し、取消済みは除外します。</p>
      {loading ? <p>読み込み中…</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>イベント</th><th>期間（日本時間）</th><th>取引数</th><th>売上</th><th>明細</th><th>状態</th></tr></thead><tbody>{events.map((event) => <tr key={event.eventId}><td>{event.name}</td><td>{event.startDate} 〜 {event.endDate}</td><td>{event.saleCount}件</td><td>{event.totalYen.toLocaleString()}円</td><td><Link href={`/admin/sales?eventId=${event.eventId}`}>取引を見る</Link></td><td>{event.status === "archived" ? "停止済み" : <button className={styles.button} type="button" disabled={busy} onClick={() => void archive(event)} aria-label={`${event.name}を停止`}>停止</button>}</td></tr>)}</tbody></table>{events.length === 0 && <p>イベントはまだありません。</p>}</div>}
      <p><Link href="/admin/sales?eventId=none">イベント未設定の取引を見る</Link></p>
      {events.map((event) => <details key={event.eventId} className={styles.panel}><summary>{event.name}の詳細・ターゲット</summary>
        <dl><dt>内容・目的</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{event.description || "未設定"}</dd>
          <dt>対象年齢層</dt><dd>{event.ageRange || "未設定"}</dd>
          <dt>ターゲットの特徴</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{event.targetAudience || "未設定"}</dd>
          <dt>想定来場者数</dt><dd>{event.expectedAttendance == null ? "未設定" : `${event.expectedAttendance.toLocaleString()}人`}</dd></dl>
      </details>)}
    </section>
  </>;
}
