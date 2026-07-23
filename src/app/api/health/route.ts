import { NextResponse } from "next/server";

import { getServerEnv } from "@/config/env";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleDriveImageClient } from "@/infrastructure/google/drive-client";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleSheetsSchemaRepository } from "@/infrastructure/google/repositories";
import { toAppError } from "@/lib/errors";

export async function GET(): Promise<Response> {
  try {
    const env = getServerEnv();
    const credentials = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY ? { clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY } : undefined;
    const tokenProvider = credentials ? new GoogleAccessTokenProvider(credentials) : undefined;
    const sheets = new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider });
    await new GoogleSheetsSchemaRepository(sheets).validateSchema();
    const drive = new GoogleDriveImageClient({ folderId: env.GOOGLE_DRIVE_IMAGE_FOLDER_ID, tokenProvider });
    await drive.checkFolderAccess();
    return NextResponse.json({ ok: true, appVersion: env.NEXT_PUBLIC_APP_VERSION, status: "healthy", checks: { spreadsheet: "ok", drive: "ok" } });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json({ ok: false, status: "unhealthy", error: { code: appError.code, message: appError.message, requestId: appError.requestId } }, { status: appError.status });
  }
}
