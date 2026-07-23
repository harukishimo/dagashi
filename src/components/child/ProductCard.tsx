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
  return (
    <article className={`${styles.productCard} ${quantity > 0 ? styles.productCardSelected : ""}`}>
      <span className={styles.categoryBadge}>{product.category}</span>
      <ProductVisual product={product} />
      <h2 className={styles.productName}>{product.name}</h2>
      <p className={styles.price}>{product.priceYen.toLocaleString("ja-JP")}円</p>
      {quantity > 0 && <span className={styles.selectionLabel}>かごに入っています</span>}
      <QuantityStepper productName={product.name} value={quantity} onChange={onQuantityChange} />
    </article>
  );
}
