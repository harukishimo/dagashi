import { randomUUID } from "node:crypto";
import { eventInputSchema, assertNoEventOverlap } from "@/domain/events";
import { isCountedSale } from "@/domain/calculations";
import { GoogleEventRepository, type EventRepository } from "@/infrastructure/google/event-repository";
import { GoogleAdminDataRepository, type AdminDataRepository } from "./data";
import { getServerEnv } from "@/config/env";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { z } from "zod";
import { AppError } from "@/lib/errors";

let createLock: Promise<unknown> = Promise.resolve();
export class EventsService {
  constructor(private readonly events: EventRepository, private readonly data: AdminDataRepository) {}
  async list() {
    const [events, sales] = await Promise.all([this.events.list(), this.data.listSales()]);
    return events.map((event) => {
      const counted = sales.filter((sale) => sale.eventId === event.eventId && isCountedSale(sale));
      return { ...event, saleCount: counted.length, totalYen: counted.reduce((sum, sale) => sum + sale.totalYen, 0) };
    }).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }
  async create(input: unknown) {
    const parsed = eventInputSchema.parse(input);
    const task = createLock.then(async () => {
      const existing = await this.events.list();
      if (existing.length >= 999) throw new AppError("CONFLICT", { details: ["イベントの上限999件に達しました。管理者に連絡してください"] });
      assertNoEventOverlap(existing, parsed);
      const event = { ...parsed, eventId: randomUUID(), createdAt: new Date().toISOString() };
      await this.events.append(event);
      return event;
    });
    createLock = task.catch(() => undefined);
    return task;
  }
  async archive(eventId: string) {
    z.string().uuid().parse(eventId);
    if (!this.events.archive) throw new AppError("CONFLICT");
    await this.events.archive(eventId);
  }
}
export function createGoogleEventsService() {
  const env = getServerEnv();
  const tokenProvider = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY ? new GoogleAccessTokenProvider({ clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY }) : undefined;
  const client = new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider });
  return new EventsService(new GoogleEventRepository(client), new GoogleAdminDataRepository(client));
}
