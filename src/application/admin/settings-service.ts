import type { Setting } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { SHEET_HEADERS } from "@/infrastructure/google/repositories";
import type { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";

/** Settings that the admin UI is allowed to read or change. Secrets never belong here. */
export const ADMIN_SETTING_KEYS = [
  "challenge_success_min_ms",
  "challenge_success_max_ms",
  "challenge_timeout_ms",
  "shop_enabled",
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];
export type AdminSettings = Partial<Record<AdminSettingKey, string>>;

const ADMIN_SETTING_KEY_SET = new Set<string>(ADMIN_SETTING_KEYS);

function text(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function assertHeader(values: unknown[]): void {
  const expected = SHEET_HEADERS.settings;
  if (values.length !== expected.length || expected.some((header, index) => text(values[index]) !== header)) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: ["settings header mismatch"] });
  }
}

function validation(message: string): AppError {
  return new AppError("VALIDATION_ERROR", { details: [message] });
}

/** Validate one value before it can be persisted to the settings sheet. */
export function validateAdminSettingValue(key: string, value: unknown): string {
  if (!ADMIN_SETTING_KEY_SET.has(key)) {
    throw validation(`変更できない設定キーです: ${key}`);
  }
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw validation(`${key} の値が不正です`);
  }
  const normalized = String(value).trim();
  if (key === "shop_enabled") {
    if (normalized !== "true" && normalized !== "false") throw validation("shop_enabled は true または false です");
    return normalized;
  }

  if (!/^\d+$/.test(normalized)) throw validation(`${key} は整数で指定してください`);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) throw validation(`${key} は安全な整数で指定してください`);
  const max = key === "challenge_timeout_ms" ? 300_000 : 60_000;
  const min = key === "challenge_timeout_ms" ? 1_000 : 0;
  if (parsed < min || parsed > max) throw validation(`${key} は ${min}〜${max} の範囲で指定してください`);
  return normalized;
}

/** Keep the response intentionally narrow; arbitrary sheet rows are never returned to a browser. */
export function filterAdminSettings(settings: Setting[]): AdminSettings {
  return Object.fromEntries(
    settings
      .filter((setting) => ADMIN_SETTING_KEY_SET.has(setting.key))
      .map((setting) => [setting.key, setting.value]),
  ) as AdminSettings;
}

export interface AdminSettingsState {
  settings: AdminSettings;
  schemaVersion: string | null;
  rows: string[][];
}

/** Small sheet adapter used only by the protected admin settings endpoint. */
export class AdminSettingsService {
  constructor(private readonly client: GoogleSheetsClient, now?: () => Date) {
    void now;
  }

  async read(): Promise<AdminSettingsState> {
    const response = await this.client.getValues("settings!A1:C100");
    const rows = response.values ?? [];
    assertHeader(rows[0] ?? []);
    const settings = rows.slice(1)
      .filter((row) => text(row[0]).trim() !== "")
      .map((row) => ({ key: text(row[0]), value: text(row[1]), updatedAt: text(row[2]) }));
    return {
      settings: filterAdminSettings(settings),
      schemaVersion: settings.find((setting) => setting.key === "schema_version")?.value ?? null,
      rows,
    };
  }

  /**
   * Runtime setting changes are intentionally disabled for the MVP. The
   * challenge code uses fixed domain constants, so accepting writes here
   * would make the admin UI suggest a feature that has no effect.
   */
  async update(updates: Record<string, unknown>): Promise<never> {
    void updates;
    throw new AppError("CONFLICT", { details: ["MVPでは設定値をSpreadsheetで管理します"] });
  }
}
