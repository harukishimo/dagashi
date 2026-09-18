import { NextResponse } from "next/server";

import { getServerEnv } from "@/config/env";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleDriveImageClient } from "@/infrastructure/google/drive-client";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleSheetsProductRepository } from "@/infrastructure/google/repositories";
import { createOpaqueImageEtag } from "@/infrastructure/google/image-etag";
import { toAppError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ productId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { productId } = await context.params;
    const env = getServerEnv();
    const credentials = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY ? { clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY } : undefined;
    const tokenProvider = credentials ? new GoogleAccessTokenProvider(credentials) : undefined;
    const sheets = new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider });
    const products = new GoogleSheetsProductRepository(sheets);
    const product = await products.findImageProductById(productId);
    if (!product || product.status !== "active" || !product.imageFileId) {
      return new Response(null, { status: 404 });
    }
    const drive = new GoogleDriveImageClient({ folderId: env.GOOGLE_DRIVE_IMAGE_FOLDER_ID, tokenProvider });
    const image = await drive.download(product.imageFileId);
    const headers = new Headers({
      "content-type": image.contentType,
      "cache-control": "private, max-age=300, stale-while-revalidate=60",
      etag: createOpaqueImageEtag(product.productId, product.imageUpdatedAt, image.contentType),
      vary: "Accept-Encoding",
    });
    if (request.headers.get("if-none-match") === headers.get("etag")) return new Response(null, { status: 304, headers });
    return new Response(image.body, { status: 200, headers });
  } catch (error) {
    const appError = toAppError(error);
    // A missing/broken image is intentionally a normal fallback condition for
    // the child UI. The product remains visible and renders fallbackEmoji.
    if (appError.code === "DRIVE_IMAGE_UNAVAILABLE" || appError.code === "NOT_FOUND") return new Response(null, { status: 404 });
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}
