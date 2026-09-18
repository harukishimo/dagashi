import type { Sale, SaleItem, SalesEvent } from "@/domain/types";
import { eventForSale } from "@/domain/events";
import { AppError } from "@/lib/errors";
import { GoogleEventRepository } from "./event-repository";
import type { GoogleSheetsClient } from "./sheets-client";

export const MANUAL_HEADERS = ["記録ID", "状態", "売上日時（日本時間）", "商品", "単価（円）", "数量", "売上金額（自動）", "メモ"];

/** Read-only projection: never append these rows to sales or subtract stock_total. */
export function parseManualSales(rows: string[][], events: SalesEvent[]) {
  if (MANUAL_HEADERS.some((h, i) => rows[0]?.[i] !== h)) throw new AppError("SHEETS_UNAVAILABLE", { details: ["手入力売上の見出しを確認してください"] });
  const sales: Sale[] = [], items: SaleItem[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const state = (r[1] ?? "").trim();
    if (!state || ["下書き", "サンプル", "取消"].includes(state)) return;
    const invalid = () => new AppError("SHEETS_UNAVAILABLE", { message: `手入力売上の${i + 2}行目に入力不備またはIDの重複があります。下書きに戻して確認してください。` });
    const id = (r[0] ?? "").trim();
    if (state !== "確定" || !/^MS-\d{4,}$/.test(id) || seen.has(id)) throw invalid();
    seen.add(id);
    const match = (r[3] ?? "").match(/^(.+) \[([0-9a-f-]{36})\]$/i);
    if (!match || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(match[2])) throw invalid();
    const rawDate = (r[2] ?? "").trim().replaceAll("/", "-").replace(" ", "T");
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? `${rawDate}T00:00:00` : rawDate;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) throw invalid();
    const date = new Date(`${normalized}+09:00`);
    if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 16) !== normalized.slice(0, 16)) throw invalid();
    const unitPriceYen = Number(r[4]), quantity = Number(r[5]);
    if (!r[4]?.trim() || !Number.isSafeInteger(unitPriceYen) || unitPriceYen < 0 || unitPriceYen > 999999 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) throw invalid();
    const soldAt = date.toISOString(), totalYen = unitPriceYen * quantity;
    if (totalYen > 999999999) throw invalid();
    const event = eventForSale(events, soldAt);
    const saleId = `manual-${id}`;
    sales.push({ source: "manual", saleId, requestId: saleId, soldAt, totalYen, writeStatus: "completed", saleStatus: "completed", paymentMethod: "other", experienceStatus: "skipped", elapsedMs: null, challengeSuccess: null, stampCount: null, voidedAt: null, voidReason: null, createdAt: soldAt, updatedAt: soldAt, eventId: event?.eventId ?? null, eventNameSnapshot: event?.name ?? null });
    items.push({ saleItemId: saleId, saleId, productId: match[2], productNameSnapshot: match[1], unitPriceYen, quantity, lineTotalYen: totalYen, createdAt: soldAt });
  });
  return { sales, items };
}

export async function readManualSales(client: GoogleSheetsClient) {
  const { values = [] } = await client.getValues("'手入力売上'!A1:H1001");
  // Empty drafts do not require another event read.
  const events = values.slice(1).some(r => r[1] === "確定") ? await new GoogleEventRepository(client).list() : [];
  return parseManualSales(values, events);
}
