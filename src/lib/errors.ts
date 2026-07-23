import { randomUUID } from "node:crypto";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SHEETS_UNAVAILABLE"
  | "DRIVE_IMAGE_UNAVAILABLE"
  | "SALE_STATUS_UNKNOWN"
  | "INTERNAL_ERROR";

const PUBLIC_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION_ERROR: "入力内容を確認してください",
  UNAUTHORIZED: "認証が必要です",
  FORBIDDEN: "この操作は許可されていません",
  NOT_FOUND: "対象のデータが見つかりません",
  CONFLICT: "現在の状態では操作できません",
  RATE_LIMITED: "しばらく待ってから再試行してください",
  SHEETS_UNAVAILABLE: "データ保存先へ接続できません",
  DRIVE_IMAGE_UNAVAILABLE: "商品画像を読み込めません",
  SALE_STATUS_UNKNOWN: "保存結果を確認できません。新しい取引を作成しないでください",
  INTERNAL_ERROR: "予期しないエラーが発生しました",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
  readonly status: number;
  readonly requestId: string;
  readonly details: readonly string[];

  constructor(
    code: AppErrorCode,
    options: {
      message?: string;
      retryable?: boolean;
      status?: number;
      requestId?: string;
      details?: readonly string[];
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? PUBLIC_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? statusForCode(code);
    this.requestId = options.requestId ?? randomUUID();
    this.details = options.details ?? [];
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  toResponse(): AppErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        requestId: this.requestId,
        details: [...this.details],
      },
    };
  }
}

export interface AppErrorResponse {
  error: {
    code: AppErrorCode;
    message: string;
    retryable: boolean;
    requestId: string;
    details: string[];
  };
}

export function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "SHEETS_UNAVAILABLE":
    case "DRIVE_IMAGE_UNAVAILABLE":
    case "SALE_STATUS_UNKNOWN":
      return 503;
    default:
      return 500;
  }
}

export function toAppError(error: unknown, requestId = randomUUID()): AppError {
  if (error instanceof AppError) return error;
  return new AppError("INTERNAL_ERROR", { requestId, cause: error });
}
