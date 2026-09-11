import { z } from "zod";

import type { Product, ProductStatus } from "./types";

const CHALLENGE_MAX_ELAPSED_MS = 60_000;

const UUID = z.string().uuid();
const ISO_DATE = z.string().datetime({ offset: true });
const nonNegativeInt = (max = Number.MAX_SAFE_INTEGER) =>
  z.number().int().nonnegative().max(max);

/** A single product emoji, including a ZWJ sequence or skin-tone modifier. */
export function isSingleEmojiGraphemeCluster(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || !("Segmenter" in Intl)) return false;

  const Segmenter = Intl.Segmenter;
  const segments = [...new Segmenter("ja", { granularity: "grapheme" }).segment(normalized)].map(
    (segment) => segment.segment,
  );
  if (segments.length !== 1) return false;

  const grapheme = segments[0];
  // Extended pictographic covers the common emoji blocks and ZWJ sequences.
  // Emoji_Presentation covers flags and symbols that do not expose that property.
  if (!/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(grapheme)) return false;
  // Do not accept ordinary ASCII letters/digits that happen to have an emoji variant.
  if (/^[0-9A-Za-z]$/u.test(grapheme)) return false;
  return true;
}

export const productStatusSchema = z.enum(["draft", "active", "sold_out", "hidden"]);

export const productSchema = z
  .object({
    productId: UUID,
    stockQuantity: z.number().int().nullable().optional(),
    name: z.string().trim().min(1).max(60),
    priceYen: nonNegativeInt(999_999),
    category: z.string().trim().max(30),
    fallbackEmoji: z.string().trim().max(16),
    imageFileId: z.string().trim().min(1).nullable(),
    imageUpdatedAt: ISO_DATE.nullable(),
    displayOrder: nonNegativeInt(),
    status: productStatusSchema,
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE,
  })
  .superRefine((product, ctx) => {
    if (product.status === "active" && !isSingleEmojiGraphemeCluster(product.fallbackEmoji)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallbackEmoji"],
        message: "active products require exactly one fallback emoji",
      });
    }
    if (product.imageFileId && !product.imageUpdatedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUpdatedAt"],
        message: "imageUpdatedAt is required when imageFileId is set",
      });
    }
    if (!product.imageFileId && product.imageUpdatedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUpdatedAt"],
        message: "imageUpdatedAt cannot be set without imageFileId",
      });
    }
  });

export const productInputSchema = z
  .object({
    stockQuantity: nonNegativeInt(999999).nullable().optional(),
    name: z.string().trim().min(1).max(60),
    priceYen: nonNegativeInt(999_999),
    category: z.string().trim().max(30).default(""),
    fallbackEmoji: z.string().trim().max(16),
    imageSource: z.string().trim().max(2_000).nullable().optional(),
    displayOrder: nonNegativeInt(),
    status: productStatusSchema,
  })
  .superRefine((product, ctx) => {
    if (product.status === "active" && !isSingleEmojiGraphemeCluster(product.fallbackEmoji)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fallbackEmoji"], message: "fallbackEmoji is required for active products" });
    }
  });

export const saleItemInputSchema = z.object({
  productId: UUID,
  quantity: z.number().int().min(1).max(99),
});

export const saleInputSchema = z.object({
  requestId: UUID,
  paymentMethod: z.enum(["cash", "other"]),
  items: z.array(saleItemInputSchema).min(1).max(200),
});

export const challengeInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("stop"), elapsedMs: z.number().int().min(0).max(CHALLENGE_MAX_ELAPSED_MS) }),
  z.object({ action: z.literal("skip") }),
  z.object({ action: z.literal("interrupt") }),
]);

export const productRowSchema = z.object({
  product_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price_yen: z.string(),
  category: z.string(),
  fallback_emoji: z.string(),
  image_file_id: z.string(),
  image_updated_at: z.string(),
  display_order: z.string(),
  status: productStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export function validateProduct(product: Product): Product {
  return productSchema.parse(product);
}

export function parseProductStatus(value: unknown): ProductStatus {
  return productStatusSchema.parse(value);
}
