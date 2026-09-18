export type ProductStatus = "draft" | "active" | "sold_out" | "hidden";
export type WriteStatus = "pending" | "completed" | "error";
export type SaleStatus = "completed" | "voided";
export type ExperienceStatus =
  | "challenge_pending"
  | "challenge_started"
  | "completed"
  | "skipped"
  | "interrupted";
export type PaymentMethod = "cash" | "other";
export type RewardStatus = "completed" | "voided";

export interface Product {
  stockQuantity?: number | null;
  productId: string;
  name: string;
  priceYen: number;
  category: string;
  fallbackEmoji: string;
  imageFileId: string | null;
  imageUpdatedAt: string | null;
  displayOrder: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  eventId?: string | null;
  eventNameSnapshot?: string | null;
  saleId: string;
  requestId: string;
  soldAt: string;
  writeStatus: WriteStatus;
  saleStatus: SaleStatus;
  totalYen: number;
  paymentMethod: PaymentMethod;
  experienceStatus: ExperienceStatus;
  elapsedMs: number | null;
  challengeSuccess: boolean | null;
  stampCount: 1 | 2 | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesEvent {
  description?: string;
  ageRange?: string;
  targetAudience?: string;
  expectedAttendance?: number | null;
  status?: "active" | "archived";
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface SaleItem {
  saleItemId: string;
  saleId: string;
  productId: string;
  productNameSnapshot: string;
  unitPriceYen: number;
  quantity: number;
  lineTotalYen: number;
  createdAt: string;
}

export interface RewardRedemption {
  redemptionId: string;
  redeemedAt: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  amountYen: 0;
  status: RewardStatus;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

export interface AuditLog {
  logId: string;
  occurredAt: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export interface ChallengeResult {
  result: "success" | "try" | "skipped" | "interrupted" | "fallback";
  elapsedMs: number | null;
  stampCount: 1 | 2;
  messageKey: "success" | "try" | "skip" | "interrupted" | "save_failed";
}
