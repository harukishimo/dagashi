import { z } from "zod";
import type { SalesEvent } from "@/domain/types";
import { eventInputSchema, eventDetailsSchema, type EventDetails } from "@/domain/events";
import { AppError } from "@/lib/errors";
import type { GoogleSheetsClient } from "./sheets-client";

export const EVENT_HEADERS = ["event_id", "name", "start_date", "end_date", "created_at", "status", "description", "age_range", "target_audience", "expected_attendance"] as const;
export interface EventRepository { list(): Promise<SalesEvent[]>; append(event: SalesEvent): Promise<void>; archive?(eventId: string): Promise<void>; updateDetails?(eventId: string, details: EventDetails): Promise<void> }
export class GoogleEventRepository implements EventRepository {
  constructor(private readonly client: GoogleSheetsClient) {}
  async list(): Promise<SalesEvent[]> {
    const { values = [] } = await this.client.getValues("events!A1:J1000");
    if (![5, 6, 10].includes(values[0]?.length) || EVENT_HEADERS.slice(0, values[0]?.length).some((header, index) => values[0][index] !== header)) throw new AppError("SHEETS_UNAVAILABLE", { details: ["events header mismatch: イベント用シートを準備してください"] });
    return values.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row) => {
      if (row.length > values[0].length) throw new AppError("SHEETS_UNAVAILABLE");
      const rawAttendance = String(row[9] ?? "").trim();
      const parsed = eventInputSchema.safeParse({ name: row[1], startDate: row[2], endDate: row[3], description: row[6] ?? "", ageRange: row[7] ?? "", targetAudience: row[8] ?? "", expectedAttendance: rawAttendance === "" ? null : /^\d+$/.test(rawAttendance) ? Number(rawAttendance) : NaN });
      if (!parsed.success || !z.string().uuid().safeParse(row[0]).success || !z.string().datetime().safeParse(row[4]).success) throw new AppError("SHEETS_UNAVAILABLE", { details: ["events row is invalid"] });
      const status = row[5] || "active";
      if (status !== "active" && status !== "archived") throw new AppError("SHEETS_UNAVAILABLE", { details: ["events status is invalid"] });
      return { eventId: row[0], ...parsed.data, createdAt: row[4], status };
    });
  }
  async append(event: SalesEvent): Promise<void> {
    const header = (await this.client.getValues("events!A1:J1")).values?.[0] ?? [];
    if (header.length !== EVENT_HEADERS.length || EVENT_HEADERS.some((value, i) => header[i] !== value)) throw new AppError("SHEETS_UNAVAILABLE", { details: ["eventsのG〜J列（詳細・ターゲット）を準備してください"] });
    await this.client.appendValues("events!A:J", [[event.eventId, event.name, event.startDate, event.endDate, event.createdAt, "active", event.description ?? "", event.ageRange ?? "", event.targetAudience ?? "", event.expectedAttendance == null ? "" : String(event.expectedAttendance)]], { uncertainWrite: true });
  }
  async archive(eventId: string): Promise<void> {
    await this.list();
    const { values = [] } = await this.client.getValues("events!A1:F1000");
    if (values[0]?.[5] !== "status") throw new AppError("SHEETS_UNAVAILABLE", { details: ["events status列を準備してください"] });
    const index = values.findIndex((row, index) => index > 0 && row[0] === eventId);
    if (index < 1) throw new AppError("NOT_FOUND");
    await this.client.updateValues(`events!F${index + 1}`, [["archived"]]);
  }
  async updateDetails(eventId: string, input: EventDetails): Promise<void> {
    z.string().uuid().parse(eventId);
    const details = eventDetailsSchema.parse(input);
    const { values = [] } = await this.client.getValues("events!A1:J1000");
    if (values[0]?.length !== EVENT_HEADERS.length || EVENT_HEADERS.some((h, i) => values[0][i] !== h)) throw new AppError("SHEETS_UNAVAILABLE");
    const index = values.findIndex((row, i) => i > 0 && row[0] === eventId);
    if (index < 1) throw new AppError("NOT_FOUND");
    await this.client.updateValues(`events!G${index + 1}:J${index + 1}`, [[details.description, details.ageRange, details.targetAudience, details.expectedAttendance == null ? "" : String(details.expectedAttendance)]]);
  }
}
