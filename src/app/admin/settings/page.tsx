"use client";

import { useEffect, useState } from "react";

import styles from "@/components/admin/admin.module.css";

interface SettingsPayload {
  settings: Record<string, string>;
  appVersion: string;
  spreadsheetSchemaVersion: string | null;
  spreadsheetIdConfigured: boolean;
  driveFolderConfigured: boolean;
  healthStatus?: string;
}

const SETTING_LABELS: Record<string, string> = {
  challenge_success_min_ms: "成功判定の下限（ミリ秒）",
  challenge_success_max_ms: "成功判定の上限（ミリ秒）",
  challenge_timeout_ms: "チャレンジタイムアウト（ミリ秒）",
  shop_enabled: "店舗受付状態",
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  async function setChallengeEnabled(enabled: boolean): Promise<void> {
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge_enabled: enabled }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "設定を保存できませんでした");
      setData((current) => current ? { ...current, settings: payload.data.settings } : current);
      setSaved("設定を保存しました。次の会計から反映されます。");
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "設定を保存できませんでした"}。画面を再読み込みして現在の設定を確認してください。`);
    } finally { setSaving(false); }
  }

  async function load(): Promise<void> {
    const [settingsResponse, healthResponse] = await Promise.all([fetch("/api/admin/settings"), fetch("/api/health")]);
    const payload = await settingsResponse.json();
    const health = await healthResponse.json();
    if (!settingsResponse.ok) throw new Error(payload.error?.message || "読込に失敗しました");
    setData({ ...payload.data, healthStatus: health.status } as SettingsPayload);
  }

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました"));
  }, []);

  return <>
    <header className={styles.header}><h1>設定・データ管理</h1></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {data && <>
      <section className={styles.panel} style={{ marginBottom: 24 }}>
        <h2>購入後の10秒チャレンジ</h2>
        <label className={styles.actionRow}>
          <input type="checkbox" role="switch" checked={data.settings.challenge_enabled !== "false"} disabled={saving} onChange={(event) => void setChallengeEnabled(event.target.checked)} />
          {data.settings.challenge_enabled !== "false" ? "オン（チャレンジを行う）" : "オフ（会計後にトップへ戻る）"}
        </label>
        <p>オフの場合、売上保存後にかごを空にしてトップ画面へ戻ります。購入スタンプは1個です。すでに会計済みの体験は変更されません。</p>
        {saving && <p role="status">保存しています…</p>}
        {saved && <p role="status">{saved}</p>}
      </section>
      <section className={styles.panel}>
        <h2>接続状態</h2>
        <dl>
          <dt>Spreadsheet</dt><dd>{data.spreadsheetIdConfigured ? "設定済み" : "未設定"}</dd>
          <dt>Drive商品画像フォルダ</dt><dd>{data.driveFolderConfigured ? "設定済み" : "未設定"}</dd>
          <dt>schema_version</dt><dd>{data.spreadsheetSchemaVersion ?? "未確認"}</dd>
          <dt>アプリバージョン</dt><dd>{data.appVersion}</dd>
          {data.healthStatus && <><dt>ヘルスチェック</dt><dd>{data.healthStatus}</dd></>}
        </dl>
      </section>
      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2>体験設定（参照のみ）</h2>
        <p className={styles.notice}>成功判定の時間とタイムアウトはコード固定です。以下の時間設定は参照表示のみです。店舗受付状態はSpreadsheetで管理します。</p>
        <dl>
          {Object.entries(SETTING_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.settings[key] ?? "未設定"}{key === "shop_enabled" && data.settings[key] ? (data.settings[key] === "true" ? "（受付中）" : "（停止中）") : ""}</dd></div>)}
        </dl>
        <p className={styles.notice} style={{ marginTop: 16 }}>認証情報やシークレットは表示しません。CSV出力機能はありません。</p>
      </section>
    </>}
  </>;
}
