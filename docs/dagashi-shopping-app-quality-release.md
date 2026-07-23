# 駄菓子 おかいもの体験アプリ 品質・リリース確認

AG-06（IMP-401〜IMP-404）の最終品質確認記録。Google Sheets / Drive は本番データを変更しないよう、結合テストではモックを使用する。

## 自動確認

2026-07-23、次のコマンドをローカルで実行した。

| コマンド | 結果 | 内容 |
|---|---|---|
| `npm run typecheck` | PASS | `next typegen` と `tsc --noEmit` |
| `npm run lint` | PASS | 警告・エラーなし（Next/Image / `next/link`へ移行済み） |
| `npm test -- --run` | PASS | 15ファイル、81テスト |
| `npm run build` | PASS | 本番バンドル生成まで完了 |
| `npm run test:e2e` | PASS（権限昇格環境） | 5件成功。通常sandboxでは`listen EPERM 0.0.0.0:3000`のため、権限昇格が必要 |

### 回帰対象

- チャレンジ境界：9,499 / 9,500 / 10,500 / 10,501ms、5秒表示境界、60秒タイムアウト。
- スタッフセッション：15分無操作失効、認証済み操作ごとのCookie更新。
- 同一`request_id`の再送・並列確定・二重stop。
- Spreadsheetの`shop_enabled=false`による商品一覧停止・支払確定拒否。
- Sheetsエラー本文の非公開、appendの不確実書込、行・列挙値・数量の検証。
- Drive画像の親フォルダ、MIME、容量、ETag取得。任意ファイルIDやSVGは拒否する。
- 管理設定のallowlist（`schema_version`や秘密キーを返さない／変更させない）。
- 未認証の管理API拒否、状態変更APIの同一Origin境界。
- 購入→チャレンジ→スタンプ→取消・特典交換→日次集計の一連の整合性。
- 子ども向けE2E（絵文字フォールバック、かご合計、肯定的な結果ポップ、アドミン未認証リダイレクト）。

## E2Eの再実行方法（Human Check）

サンドボックス外またはローカルでポート3000をbindできる環境で、テスト用環境変数を設定して実行する。本番Spreadsheet / Driveは使用しない。

```bash
cp .env.example .env.local
# 検証用Spreadsheet/Driveとテスト用PINハッシュを設定
npm run dev
# 別ターミナル
npm run test:e2e
```

確認項目：

- 1,024px、1,280px、125%表示倍率で主要操作が欠けないこと。
- キーボードフォーカス、見出し順、`alt`、dialog、live region、色以外の成功・不成功表示。
- `prefers-reduced-motion: reduce`でチャレンジ結果ポップの操作性が維持されること。
- 通常購入、成功・不成功・スキップ・中断・60秒終了、再読込後の再挑戦不可。
- 取消と特典交換が管理集計に反映されること。

## リリース前ゲート

- [x] Human Check環境でE2E全件を実行（動画・スクリーンショットは未収録）。
- [ ] `/api/health` がSpreadsheetの6タブ・ヘッダー・`schema_version=2`とDrive専用フォルダを確認して`healthy`を返す。
- [ ] 本番用と検証用のSpreadsheet / Driveを分離し、実売上を投入しないスモークテストを実施する。
- [ ] Spreadsheetのバックアップとロールバック担当、通信障害時の紙運用担当を決める。
- [x] lint警告（Next.jsの`<img>`等）を解消し、`next/image` / `next/link`へ移行した。

## 最終レビュー判定

- RV-RED-FINAL：P0/P1なし。Sheets、売上競合、認証、Drive、チャレンジ境界、管理画面を再攻撃済み。
- RV-BLUE-FINAL：Red Findingの防御と回帰テストを確認。P0/P1なし。
- RV-PURPLE-FINAL：`CONDITIONAL PASS`。実Google Sheets/Drive staging smokeと複数インスタンス運用確認が昇格条件。

## 未解決の担当引き継ぎ

- Google Sheetsが複数インスタンスで動作する場合、プロセス内mutexだけでは同一`request_id`競合を防げない。単一店舗PC運用の前提を明記し、将来の複数インスタンス化では一意制約相当の仕組みを再設計する。
- Spreadsheetの`products`・`settings`余剰列は現状スキーマ異常として停止する。列追加を行う場合はヘッダー・変換・結合テストを同時に改訂する。
- challenge境界・タイムアウトはMVPではコード固定で、Spreadsheetの同名設定は参照表示のみ。`shop_enabled`だけは実行系へ反映する。
- E2Eの通常sandbox `EPERM` はコードの合否ではなく実行環境の制約である。今回の権限昇格実行では5件成功したが、実店舗の検証Spreadsheet/Drive接続は未確認である。
