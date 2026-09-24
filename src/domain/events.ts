import { z } from "zod";
import type { SalesEvent } from "./types";
import { AppError } from "@/lib/errors";

export const eventDetailsSchema = z.object({
  description: z.string().trim().max(2000),
  ageRange: z.string().trim().max(120),
  targetAudience: z.string().trim().max(500),
  expectedAttendance: z.number().int().min(0).max(1_000_000).nullable(),
}).strict();
export type EventDetails = z.infer<typeof eventDetailsSchema>;

export const eventDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "存在する日付を入力してください");
export const eventInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startDate: eventDateSchema,
  endDate: eventDateSchema,
  description: z.string().trim().max(2000).optional().default(""),
  ageRange: z.string().trim().max(120).optional().default(""),
  targetAudience: z.string().trim().max(500).optional().default(""),
  expectedAttendance: z.number().int().min(0).max(1_000_000).nullable().optional().default(null),
}).strict().refine((event) => event.startDate <= event.endDate, "開始日は終了日以前にしてください");

export function eventForSale(events: SalesEvent[], soldAt: string): SalesEvent | null {
  const date = new Date(soldAt);
  if (!Number.isFinite(date.getTime())) throw new AppError("VALIDATION_ERROR");
  const day = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const matches = events.filter((event) => event.status !== "archived" && event.startDate <= day && event.endDate >= day);
  if (matches.length > 1) throw new AppError("CONFLICT", { details: ["イベントの期間が重複しています。管理者に確認してください"] });
  return matches[0] ?? null;
}

export function assertNoEventOverlap(events: SalesEvent[], candidate: { startDate: string; endDate: string }): void {
  if (events.some((event) => event.status !== "archived" && event.startDate <= candidate.endDate && candidate.startDate <= event.endDate)) {
    throw new AppError("CONFLICT", { details: ["同じ日を含むイベントが既にあります。期間を変更してください"] });
  }
}
