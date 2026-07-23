# 駄菓子 おかいもの体験アプリ

子どもが商品を選び、合計を確認し、支払い後に10秒チャレンジを体験するMVPです。商品と売上の正本はGoogle Spreadsheet、商品画像は指定Google Driveフォルダです。ブラウザからGoogle APIを直接呼ばず、Next.jsのサーバー経由で接続します。

## ローカル起動

対応Node.jsは20.11以上22未満です。

```bash
npm ci
cp .env.example .env.local
# .env.localへ実際の値を設定
npm run dev
```

ブラウザで`http://localhost:3000`を開き、公開ヘルスチェックを確認します。

```bash
curl http://localhost:3000/api/health
```

Google APIへ接続できる環境では、サービスアカウントに次の権限を付与します。現行実装はサービスアカウント環境変数を必須とし、ADC/Workload Identityの自動検出はまだ有効化していません。

- Spreadsheet：対象ファイルの編集者権限（読み取りだけの画面では閲覧者でも可）
- Drive：商品画像フォルダの閲覧者権限

指定リソース：

- Spreadsheet: [dagashi_shoping](https://docs.google.com/spreadsheets/d/1yhO3cx1ESXCW9MTmHTKGixLR_fuyD7KFEyNW6Fs3xM8/edit)
- Drive画像フォルダ: [商品画像フォルダ](https://drive.google.com/drive/folders/1uhYVw7gofnxWvdbz_F3oHMidww1f2AR-)

## 環境変数

`.env.example`を項目の正本として使用してください。次の値はサーバー側だけで読み込みます。

| 変数 | 用途 |
|---|---|
| `GOOGLE_SPREADSHEET_ID` | 正本Spreadsheet ID |
| `GOOGLE_DRIVE_IMAGE_FOLDER_ID` | 商品画像フォルダID |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | サービスアカウント認証（必須） |
| `ADMIN_PIN_HASH` | scrypt形式のスタッフPINハッシュ |
| `SESSION_SECRET` | 32文字以上のセッション署名鍵 |
| `APP_TIMEZONE` | IANAタイムゾーン（`Asia/Tokyo`） |
| `NEXT_PUBLIC_APP_VERSION` | 公開アプリバージョン |

PINハッシュは平文を保存せず、同梱スクリプトで生成できます（入力したPINがシェル履歴に残る運用では、履歴削除や安全な対話入力を行ってください）。

```bash
node scripts/hash-pin.mjs 1234
openssl rand -base64 32  # SESSION_SECRET用。32文字以上を設定
```

出力されたscrypt文字列を`ADMIN_PIN_HASH`へ設定し、サービスアカウントの秘密鍵は改行を`\\n`として1行にするか、利用環境のsecret managerで改行を保持します。秘密鍵、実PIN、`.env.local`はコミットしないでください。

## テスト・品質確認

詳細な実行結果と、sandboxでE2Eを実行できない場合のHuman Checkは [`docs/dagashi-shopping-app-quality-release.md`](docs/dagashi-shopping-app-quality-release.md) を参照してください。

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

初回のみPlaywrightのChromiumを取得します。

```bash
npx playwright install chromium
```

Google APIの通常テストはモックRepositoryを使用します。実APIスモークテストを行う場合は本番と分離した検証用Spreadsheet/Driveを使い、売上行を自動投入しないでください。

必須境界値には、チャレンジ成功判定（9,499／9,500／10,500／10,501ms）、5秒表示境界、再送・二重確定、部分書込・応答不明、任意Drive file ID拒否、未認証管理API拒否を含めます。

## 運用上の注意

- Drive画像は任意です。有効な画像を優先し、未設定・読込失敗時は商品ごとの`fallback_emoji`を表示します。
- `active`商品には必ず商品別`fallback_emoji`を設定します。
- 10秒チャレンジは計測中4.99秒まで表示し、5.00秒以降は数字を隠します。計測と停止操作は継続します。
- 取消は行削除ではなく状態更新で記録します。
- CSV出力機能は実装しません。管理者はSpreadsheetを直接確認します。
- 子どもの氏名、顔写真、カード番号、デジタルスタンプ残高は取得・保存しません。
