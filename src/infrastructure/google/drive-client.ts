import { AppError } from "@/lib/errors";

import type { GoogleAccessTokenProvider, GoogleFetch } from "./auth";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";
const MAX_BYTES = 500 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);

export interface DriveImageMetadata {
  id: string;
  name: string;
  mimeType: "image/webp" | "image/png" | "image/jpeg";
  size: number;
  modifiedTime: string;
  parents: string[];
  trashed: boolean;
}

export interface DriveImageContent {
  body: ArrayBuffer;
  contentType: DriveImageMetadata["mimeType"];
  etag?: string;
}

export interface DriveImageRepository {
  inspect(fileId: string): Promise<DriveImageMetadata>;
  download(fileId: string): Promise<DriveImageContent>;
  normalizeFileId(source: string): string;
}

export interface DriveFolderRepository {
  checkFolderAccess(): Promise<void>;
}

interface DriveClientOptions {
  folderId: string;
  tokenProvider?: GoogleAccessTokenProvider;
  fetchImpl?: GoogleFetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function imageError(retryable = false, status = 503, cause?: unknown): AppError {
  return new AppError("DRIVE_IMAGE_UNAVAILABLE", { retryable, status, cause });
}

export function normalizeDriveFileId(source: string): string {
  const value = source.trim();
  if (!value) throw imageError(false, 400);

  let fileId = value;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") throw imageError(false, 400);
      const pathMatch = url.pathname.match(/^\/file\/d\/([^/]+)(?:\/view)?\/?$/);
      if (pathMatch) {
        fileId = decodeURIComponent(pathMatch[1]);
      } else if (url.pathname === "/open") {
        fileId = url.searchParams.get("id") ?? "";
      } else {
        fileId = "";
      }
    }
  } catch {
    throw imageError(false, 400);
  }

  if (!/^[A-Za-z0-9_-]{1,200}$/.test(fileId) || fileId.includes("/")) throw imageError(false, 400);
  return fileId;
}

export class GoogleDriveImageClient implements DriveImageRepository, DriveFolderRepository {
  private readonly fetchImpl: GoogleFetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: DriveClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  normalizeFileId(source: string): string {
    return normalizeDriveFileId(source);
  }

  async checkFolderAccess(): Promise<void> {
    const data = await this.request<Record<string, unknown>>(`/${encodeURIComponent(this.options.folderId)}?fields=id,mimeType,trashed`);
    if (data.id !== this.options.folderId || data.mimeType !== "application/vnd.google-apps.folder" || data.trashed === true) {
      throw imageError(false, 422);
    }
  }

  async inspect(fileIdSource: string): Promise<DriveImageMetadata> {
    const fileId = normalizeDriveFileId(fileIdSource);
    const data = await this.request<Record<string, unknown>>(`/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,parents,trashed`);
    const mimeType = typeof data.mimeType === "string" ? data.mimeType : "";
    const size = Number(data.size ?? NaN);
    const parents = Array.isArray(data.parents) ? data.parents.filter((item): item is string => typeof item === "string") : [];
    const metadata: DriveImageMetadata = {
      id: typeof data.id === "string" ? data.id : fileId,
      name: typeof data.name === "string" ? data.name : "",
      mimeType: mimeType as DriveImageMetadata["mimeType"],
      size,
      modifiedTime: typeof data.modifiedTime === "string" ? data.modifiedTime : "",
      parents,
      trashed: data.trashed === true,
    };

    if (!metadata.id || metadata.trashed || !parents.includes(this.options.folderId) || !IMAGE_MIME_TYPES.has(mimeType) || !Number.isInteger(size) || size < 0 || size > MAX_BYTES) {
      throw imageError(false, 422);
    }
    return metadata;
  }

  async download(fileIdSource: string): Promise<DriveImageContent> {
    const metadata = await this.inspect(fileIdSource);
    const response = await this.requestResponse(`/${encodeURIComponent(metadata.id)}?alt=media`);
    if (!response.ok) throw imageError(isRetryableStatus(response.status), response.status || 503);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0] ?? "";
    if (contentType !== metadata.mimeType) throw imageError(false, 422);
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_BYTES) throw imageError(false, 422);
    return { body, contentType: metadata.mimeType, etag: response.headers.get("etag") ?? undefined };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.requestResponse(path);
    const body = await response.text();
    if (!response.ok) throw imageError(isRetryableStatus(response.status), response.status || 503);
    return (body ? JSON.parse(body) : {}) as T;
  }

  private async requestResponse(path: string): Promise<Response> {
    if (!this.options.tokenProvider) throw imageError(false, 503);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const token = await this.options.tokenProvider.getToken();
        const response = await this.fetchImpl(`${DRIVE_BASE}${path}`, {
          signal: AbortSignal.timeout(10_000),
          headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        });
        if (response.ok || !isRetryableStatus(response.status) || attempt === 3) return response;
        lastError = imageError(true, response.status);
      } catch (error) {
        // A timeout, fetch TypeError, or token endpoint failure must not escape
        // as a raw runtime exception. Classify it as a retryable Drive outage;
        // callers can then render the normal emoji fallback or unhealthy state.
        lastError = imageError(true, 503, error);
        if (attempt === 3) throw lastError;
      }
      await this.sleep(2 ** (attempt - 1) * 100);
    }
    throw lastError instanceof Error ? lastError : imageError(true);
  }
}
