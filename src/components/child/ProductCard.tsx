import { ProductVisual } from "./ProductVisual";
import { QuantityStepper } from "./QuantityStepper";
import type { ChildProduct } from "./types";
import styles from "./child-ui.module.css";

interface ProductCardProps {
  product: ChildProduct;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}

export function ProductCard({ product, quantity, onQuantityChange }: ProductCardProps): React.JSX.Element {
  const soldOut = product.status === "sold_out" || (product.stockQuantity != null && product.stockQuantity <= 0);
  return (
    <article className={`${styles.productCard} ${soldOut ? styles.soldOut : quantity > 0 ? styles.productCardSelected : ""}`}>
      <span className={styles.categoryBadge}>{product.category}</span>
      <ProductVisual product={product} />
      <h2 className={styles.productName}>{product.name}</h2>
      <p className={styles.price}>{product.priceYen.toLocaleString("ja-JP")}円</p>
      {quantity > 0 && <span className={styles.selectionLabel}>かごに入っています</span>}
      {soldOut && <p className={styles.soldOutLabel}>売り切れ</p>}
      <QuantityStepper productName={product.name} value={quantity} max={soldOut ? 0 : Math.min(20, product.stockQuantity ?? 20)} onChange={onQuantityChange} />
    </article>
  );
}
