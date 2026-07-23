import { AppError } from "@/lib/errors";

import type { GoogleAccessTokenProvider, GoogleFetch } from "./auth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const MAX_ATTEMPTS = 3;

export interface SheetsValueResponse {
  range?: string;
  majorDimension?: "ROWS" | "COLUMNS";
  values?: string[][];
}

export interface SheetsClientOptions {
  spreadsheetId: string;
  tokenProvider?: GoogleAccessTokenProvider;
  fetchImpl?: GoogleFetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function responseError(status: number): AppError {
  return new AppError(status === 429 ? "RATE_LIMITED" : "SHEETS_UNAVAILABLE", {
    retryable: isRetryableStatus(status),
    status: status || 503,
    // Never return Google API response bodies: they may contain resource IDs
    // or authentication details. Keep the public error classified only.
    details: [],
  });
}

function transportError(cause: unknown): AppError {
  return new AppError("SHEETS_UNAVAILABLE", { retryable: true, status: 503, cause });
}

export class GoogleSheetsClient {
  private readonly fetchImpl: GoogleFetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: SheetsClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async getValues(range: string): Promise<SheetsValueResponse> {
    return this.request<SheetsValueResponse>(`/${encodeURIComponent(this.options.spreadsheetId)}/values/${encodeURIComponent(range)}`);
  }

  async appendValues(range: string, values: string[][], options: { uncertainWrite?: boolean } = {}): Promise<void> {
    try {
      // values.append is not idempotent: a response timeout can occur after
      // Google has already inserted the row. Never resend an append request.
      await this.request<unknown>(`/${encodeURIComponent(this.options.spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ range, majorDimension: "ROWS", values }),
      }, { retryable: false });
    } catch (error) {
      if (options.uncertainWrite && (!(error instanceof AppError) || error.retryable || error.code === "SHEETS_UNAVAILABLE")) {
        throw new AppError("SALE_STATUS_UNKNOWN", { retryable: true, cause: error });
      }
      throw error;
    }
  }

  async updateValues(range: string, values: string[][]): Promise<void> {
    await this.request<unknown>(`/${encodeURIComponent(this.options.spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}, options: { retryable?: boolean } = {}): Promise<T> {
    if (!this.options.tokenProvider) {
      throw new AppError("SHEETS_UNAVAILABLE", { message: "Google API credentials are not configured", status: 503 });
    }

    let lastError: unknown;
    const maxAttempts = options.retryable === false ? 1 : MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const token = await this.options.tokenProvider.getToken();
        const response = await this.fetchImpl(`${SHEETS_BASE}${path}`, {
          ...init,
          signal: init.signal ?? AbortSignal.timeout(10_000),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            ...init.headers,
          },
        });
        const bodyText = await response.text();
        if (response.ok) return (bodyText ? JSON.parse(bodyText) : {}) as T;
        const apiError = responseError(response.status);
        if (!apiError.retryable || attempt === maxAttempts) throw apiError;
        lastError = apiError;
      } catch (error) {
        const classified = error instanceof AppError ? error : transportError(error);
        lastError = classified;
        if (!classified.retryable) throw classified;
        if (attempt === maxAttempts) throw classified;
      }
      await this.sleep(2 ** (attempt - 1) * 100);
    }
    throw lastError instanceof Error ? lastError : new AppError("SHEETS_UNAVAILABLE", { retryable: true });
  }
}
