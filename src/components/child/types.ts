import type { CustomerType } from "@/domain/customer-survey";
export type ProductStatus = "draft" | "active" | "sold_out" | "hidden";

/** The small, client-safe product contract returned by GET /api/products. */
export interface ChildProduct {
  stockQuantity?: number | null;
  productId: string;
  name: string;
  priceYen: number;
  category?: string;
  fallbackEmoji: string;
  displayOrder?: number;
  imageUrl?: string | null;
  imageUpdatedAt?: string | null;
  status?: ProductStatus;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product: ChildProduct;
}

export interface StoredCart {
  customerType?: CustomerType;
  requestId: string;
  items: Array<{
    productId: string;
    quantity: number;
    product: ChildProduct;
  }>;
}

export interface ProductsResponse {
  customerSurveyEnabled?: boolean;
  shopDisplayMode?: "flat" | "price" | "category";
  data?: { products?: ChildProduct[] };
  products?: ChildProduct[];
  error?: { message?: string };
}
