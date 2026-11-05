import { getServerEnv } from "@/config/env";
import { parseOperationSettings } from "@/domain/operation-settings";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleSheetsSettingsRepository } from "@/infrastructure/google/repositories";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";

export async function readOperationSettings() {
  const env = getServerEnv();
  const tokenProvider = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY ? new GoogleAccessTokenProvider({ clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY }) : undefined;
  const repo = new GoogleSheetsSettingsRepository(new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider }));
  return parseOperationSettings(await repo.list());
}
