import { z } from "zod";
import type { SalesEvent } from "@/domain/types";
import { eventInputSchema } from "@/domain/events";
import { AppError } from "@/lib/errors";
import type { GoogleSheetsClient } from "./sheets-client";

export const EVENT_HEADERS = ["event_id", "name", "start_date", "end_date", "created_at", "status"] as const;
export interface EventRepository { list(): Promise<SalesEvent[]>; append(event: SalesEvent): Promise<void>; archive?(eventId: string): Promise<void> }
export class GoogleEventRepository implements EventRepository {
  constructor(private readonly client: GoogleSheetsClient) {}
  async list(): Promise<SalesEvent[]> {
    const { values = [] } = await this.client.getValues("events!A1:F1000");
    if (![5, 6].includes(values[0]?.length) || EVENT_HEADERS.slice(0, values[0]?.length).some((header, index) => values[0][index] !== header)) throw new AppError("SHEETS_UNAVAILABLE", { details: ["events header mismatch: イベント用シートを準備してください"] });
    return values.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row) => {
      const parsed = eventInputSchema.safeParse({ name: row[1], startDate: row[2], endDate: row[3] });
      if (!parsed.success || !z.string().uuid().safeParse(row[0]).success || !z.string().datetime().safeParse(row[4]).success) throw new AppError("SHEETS_UNAVAILABLE", { details: ["events row is invalid"] });
      const status = row[5] || "active";
      if (status !== "active" && status !== "archived") throw new AppError("SHEETS_UNAVAILABLE", { details: ["events status is invalid"] });
      return { eventId: row[0], ...parsed.data, createdAt: row[4], status };
    });
  }
  async append(event: SalesEvent): Promise<void> {
    await this.client.appendValues("events!A:F", [[event.eventId, event.name, event.startDate, event.endDate, event.createdAt, "active"]], { uncertainWrite: true });
  }
  async archive(eventId: string): Promise<void> {
    await this.list();
    const { values = [] } = await this.client.getValues("events!A1:F1000");
    if (values[0]?.[5] !== "status") throw new AppError("SHEETS_UNAVAILABLE", { details: ["events status列を準備してください"] });
    const index = values.findIndex((row, index) => index > 0 && row[0] === eventId);
    if (index < 1) throw new AppError("NOT_FOUND");
    await this.client.updateValues(`events!F${index + 1}`, [["archived"]]);
  }
}
