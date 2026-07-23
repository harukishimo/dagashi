import { createHash } from "node:crypto";

/** Keep the browser cache validator opaque; never forward a Drive ETag/file ID. */
export function createOpaqueImageEtag(productId: string, imageUpdatedAt: string | null, contentType: string): string {
  return `"${createHash("sha256").update(`${productId}:${imageUpdatedAt ?? ""}:${contentType}`).digest("hex")}"`;
}
