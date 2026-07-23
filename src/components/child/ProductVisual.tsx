"use client";

import Image from "next/image";
import { useState } from "react";
import type { ChildProduct } from "./types";
import styles from "./child-ui.module.css";

interface ProductVisualProps {
  product: Pick<ChildProduct, "name" | "fallbackEmoji" | "imageUrl" | "imageUpdatedAt">;
  className?: string;
  showFallbackLabel?: boolean;
}

export function withImageVersion(imageUrl: string, imageUpdatedAt?: string | null): string {
  if (!imageUpdatedAt || /(?:\?|&)v=/.test(imageUrl)) return imageUrl;
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}v=${encodeURIComponent(imageUpdatedAt)}`;
}

/**
 * Drive images are always served by the same-origin image route. If the route
 * is unavailable, the card keeps its dimensions and shows the product emoji.
 */
export function ProductVisual({ product, className = "", showFallbackLabel = false }: ProductVisualProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !failed;
  return (
    <div className={`${styles.visual} ${className}`}>
      {showImage ? (
        <Image
          src={withImageVersion(product.imageUrl ?? "", product.imageUpdatedAt)}
          alt={product.name}
          width={320}
          height={320}
          sizes="(max-width: 768px) 45vw, 240px"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.fallbackEmoji} role="img" aria-label={product.name}>
          {product.fallbackEmoji}
        </span>
      )}
      {showFallbackLabel && !showImage && <span className={styles.visualLabel}>えもじで表示</span>}
    </div>
  );
}
