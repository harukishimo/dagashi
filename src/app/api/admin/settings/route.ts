import { NextResponse } from "next/server";

import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { AdminSettingsService } from "@/application/admin/settings-service";
import { getServerEnv } from "@/config/env";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { AppError, toAppError } from "@/lib/errors";

function createSettingsService(): AdminSettingsService {
  const env = getServerEnv();
  const credentials = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY
    ? { clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY }
    : undefined;
  const tokenProvider = credentials ? new GoogleAccessTokenProvider(credentials) : undefined;
  return new AdminSettingsService(new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider }));
}

export async function GET(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const env = getServerEnv();
    const state = await createSettingsService().read();
    return refreshAdminSessionCookie(request, NextResponse.json({ data: {
      settings: state.settings,
      appVersion: env.NEXT_PUBLIC_APP_VERSION,
      spreadsheetSchemaVersion: state.schemaVersion,
      spreadsheetIdConfigured: Boolean(env.GOOGLE_SPREADSHEET_ID),
      driveFolderConfigured: Boolean(env.GOOGLE_DRIVE_IMAGE_FOLDER_ID),
    } }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    let body: unknown;
    try { body = await request.json(); } catch { throw new AppError("VALIDATION_ERROR"); }
    const settings = await createSettingsService().update(body as Record<string, unknown>);
    return refreshAdminSessionCookie(request, NextResponse.json({ data: { settings } }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}
