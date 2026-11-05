// Run once by one operator. Default is read-only; --apply adds missing schema only.
import { createSign } from "node:crypto";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const email = process.env.GOOGLE_CLIENT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!spreadsheetId || !email || !key) throw new Error("Google Sheets環境変数を設定してください");
const now = Math.floor(Date.now() / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key, "base64url")}`;
const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
if (!tokenResponse.ok) throw new Error(`Google認証エラー (${tokenResponse.status})`);
const { access_token: token } = await tokenResponse.json();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
async function api(url, init = {}) {
  const response = await fetch(base + url, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Sheets APIエラー (${response.status})`);
  return response.json();
}
const get = async range => (await api(`/values/${encodeURIComponent(range)}`)).values ?? [];
const metadata = await api("?fields=sheets(properties(sheetId,title,gridProperties))");
const salesSheet = metadata.sheets.find(sheet => sheet.properties.title === "sales")?.properties;
if (!salesSheet || salesSheet.gridProperties.columnCount < 17) throw new Error("salesシートのイベント列を確認してください");
const needsColumn = salesSheet.gridProperties.columnCount === 17;
const [settings, header, existingColumn] = await Promise.all([get("settings!A1:C100"), get(`sales!A1:${needsColumn ? "Q" : "R"}1`), needsColumn ? [] : get("sales!R:R")]);
if (settings[0]?.join() !== "key,value,updated_at") throw new Error("settings見出しを確認してください");
const expected = "sale_id,request_id,sold_at,write_status,sale_status,total_yen,payment_method,experience_status,elapsed_ms,challenge_success,stamp_count,voided_at,void_reason,created_at,updated_at,event_id,event_name_snapshot".split(",");
if (!header[0] || ![17, 18].includes(header[0].length) || expected.some((h, i) => header[0][i] !== h)) throw new Error("sales見出しを確認してください");
if (header[0].length === 18 && header[0][17] !== "customer_type") throw new Error("sales R列は使用されています");
if (header[0].length === 17 && existingColumn.some(row => row.some(Boolean))) throw new Error("sales R列に既存データがあるため中止しました");
const defaults = { checkout_pin_required: "true", shop_display_mode: "flat", customer_survey_enabled: "false" };
const missing = [];
for (const [name, value] of Object.entries(defaults)) {
  const matches = settings.filter(row => row[0] === name);
  if (matches.length > 1) throw new Error(`設定重複: ${name}`);
  if (matches.length && !(name === "shop_display_mode" ? ["flat", "price", "category"] : ["true", "false"]).includes(matches[0][1])) throw new Error(`設定値を確認: ${name}`);
  if (!matches.length) missing.push([name, value, new Date().toISOString()]);
}
if (settings.length + missing.length > 100) throw new Error("settingsの100行制限を確認してください");
const changes = [];
if (missing.length) changes.push({ range: `settings!A${settings.length + 1}:C${settings.length + missing.length}`, values: missing });
if (header[0].length === 17) changes.push({ range: "sales!R1", values: [["customer_type"]] });
console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", addSalesColumn: needsColumn, changes: changes.map(change => ({ range: change.range, keys: change.values.map(row => row[0]) })) }, null, 2));
if (process.argv.includes("--apply") && changes.length) {
  if (needsColumn) await api(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: salesSheet.sheetId, gridProperties: { columnCount: 18 } }, fields: "gridProperties.columnCount" } }] }) });
  await api("/values:batchUpdate", { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: changes }) });
  const [afterSettings, afterHeader] = await Promise.all([get("settings!A1:C100"), get("sales!R1")]);
  if (afterHeader[0]?.[0] !== "customer_type" || Object.keys(defaults).some(name => afterSettings.filter(row => row[0] === name).length !== 1)) throw new Error("移行後の確認に失敗しました");
  console.log("移行と再読み取り確認が完了しました。既存売上・在庫・設定値は保持しています。");
}
