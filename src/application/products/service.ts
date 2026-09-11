import { randomUUID } from "node:crypto";

import { productInputSchema, validateProduct } from "@/domain/validation";
import type { AuditLog, Product } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/config/env";

import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleDriveImageClient, type DriveImageRepository } from "@/infrastructure/google/drive-client";
import { GoogleSheetsAuditLogRepository, GoogleSheetsProductRepository, GoogleSheetsSettingsRepository, type AuditLogRepository, type ProductRepository, type SettingsRepository } from "@/infrastructure/google/repositories";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";

export interface ProductInput {
  stockQuantity?: number | null;
  name: string;
  priceYen: number;
  category?: string;
  fallbackEmoji: string;
  imageSource?: string | null;
  displayOrder: number;
  status: Product["status"];
}

export interface ProductServiceResult {
  product: Product;
  imageWarning?: string;
}

export interface ProductServiceDependencies {
  products: ProductRepository;
  images: DriveImageRepository;
  audit: AuditLogRepository;
  settings?: SettingsRepository;
  now?: () => Date;
}

function toAudit(log: Omit<AuditLog, "logId" | "occurredAt">, now: Date): AuditLog {
  return { ...log, logId: randomUUID(), occurredAt: now.toISOString() };
}

export class ProductService {
  private readonly now: () => Date;

  constructor(private readonly deps: ProductServiceDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  async list({ activeOnly = false }: { activeOnly?: boolean } = {}): Promise<Product[]> {
    const products = await this.deps.products.listAll();
    if (activeOnly && this.deps.settings) {
      const shopEnabled = await this.deps.settings.find("shop_enabled");
      if (shopEnabled?.value.trim().toLowerCase() === "false") return [];
    }
    return products.filter((product) => !activeOnly || product.status === "active" || product.status === "sold_out");
  }

  async get(productId: string): Promise<Product> {
    const product = await this.deps.products.findById(productId);
    if (!product) throw new AppError("NOT_FOUND");
    return product;
  }

  async create(input: ProductInput): Promise<ProductServiceResult> {
    const parsed = productInputSchema.parse(input);
    const now = this.now().toISOString();
    const imageResolution = await this.resolveImage(parsed.imageSource);
    const visual = imageResolution.visual;
    const product: Product = {
      productId: randomUUID(),
      stockQuantity: parsed.stockQuantity ?? null,
      name: parsed.name,
      priceYen: parsed.priceYen,
      category: parsed.category,
      fallbackEmoji: parsed.fallbackEmoji,
      imageFileId: visual?.fileId ?? null,
      imageUpdatedAt: visual?.updatedAt ?? null,
      displayOrder: parsed.displayOrder,
      status: parsed.status,
      createdAt: now,
      updatedAt: now,
    };
    validateProduct(product);
    await this.deps.products.create(product);
    await this.deps.audit.append(toAudit({ action: "product.create", targetType: "product", targetId: product.productId, summary: `商品を作成: ${product.name}` }, this.now()));
    return { product, imageWarning: imageResolution.warning };
  }

  async update(productId: string, input: ProductInput): Promise<ProductServiceResult> {
    const current = await this.get(productId);
    const parsed = productInputSchema.parse(input);
    const imageResolution = parsed.imageSource === undefined
      ? current.imageFileId
        ? { visual: { fileId: current.imageFileId, updatedAt: current.imageUpdatedAt ?? this.now().toISOString() } }
        : { visual: undefined }
      : await this.resolveImage(parsed.imageSource);
    const visual = imageResolution.visual;
    const product: Product = {
      ...current,
      stockQuantity: parsed.stockQuantity === undefined ? current.stockQuantity : parsed.stockQuantity,
      name: parsed.name,
      priceYen: parsed.priceYen,
      category: parsed.category,
      fallbackEmoji: parsed.fallbackEmoji,
      imageFileId: visual?.fileId ?? null,
      imageUpdatedAt: visual?.updatedAt ?? null,
      displayOrder: parsed.displayOrder,
      status: parsed.status,
      updatedAt: this.now().toISOString(),
    };
    validateProduct(product);
    await this.deps.products.update({ ...product, stockQuantity: parsed.stockQuantity });
    await this.deps.audit.append(toAudit({ action: "product.update", targetType: "product", targetId: product.productId, summary: `商品を更新: ${product.name}` }, this.now()));
    return { product, imageWarning: imageResolution.warning };
  }

  private async resolveImage(source: string | null | undefined): Promise<{ visual?: { fileId: string; updatedAt: string }; warning?: string }> {
    if (!source?.trim()) return { visual: undefined };
    try {
      const fileId = this.deps.images.normalizeFileId(source);
      const metadata = await this.deps.images.inspect(fileId);
      return { visual: { fileId: metadata.id, updatedAt: metadata.modifiedTime || this.now().toISOString() } };
    } catch (error) {
      if (error instanceof AppError && error.code === "DRIVE_IMAGE_UNAVAILABLE") {
        return { visual: undefined, warning: "Drive画像を確認できません。フォールバック絵文字を表示します" };
      }
      throw error;
    }
  }
}

export function createGoogleProductService(): ProductService {
  const env = getServerEnv();
  const credentials = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY ? { clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY } : undefined;
  const tokenProvider = credentials ? new GoogleAccessTokenProvider(credentials) : undefined;
  const sheets = new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider });
  const images = new GoogleDriveImageClient({ folderId: env.GOOGLE_DRIVE_IMAGE_FOLDER_ID, tokenProvider });
  return new ProductService({
    products: new GoogleSheetsProductRepository(sheets),
    images,
    audit: new GoogleSheetsAuditLogRepository(sheets),
    settings: new GoogleSheetsSettingsRepository(sheets),
  });
}
