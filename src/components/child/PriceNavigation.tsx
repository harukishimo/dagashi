"use client";

import { useRef, useState } from "react";
import styles from "./child-ui.module.css";

export function PriceNavigation({ prices, activePrice, onSelect }: { prices: number[]; activePrice: number | null; onSelect: (price: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const links = () => <nav aria-label="価格帯へ移動" className={styles.priceNavList}>{prices.map((price, index) => <a key={price} className={styles.priceNavLink} data-price-tone={index % 5} href={`#price-${price}`} aria-label={`${price.toLocaleString("ja-JP")}円のおかしへ移動`} aria-current={price === activePrice ? "location" : undefined} onClick={event => { event.preventDefault(); dialog.current?.close(); onSelect(price); }}>{price.toLocaleString("ja-JP")}円</a>)}</nav>;
  return <>
    <aside className={styles.priceSidebar} aria-label="価格帯メニュー"><h2>ねだんで<br />えらぶ</h2>{links()}</aside>
    <button className={styles.priceMenuToggle} type="button" aria-expanded={open} aria-controls="price-menu-dialog" onClick={() => { dialog.current?.showModal(); setOpen(true); }}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>ねだんメニュー</button>
    <dialog id="price-menu-dialog" ref={dialog} className={styles.priceDrawer} aria-label="価格帯メニュー" onClose={() => setOpen(false)}>
      <div className={styles.priceDrawerHeader}><h2>ねだんで えらぶ</h2><button type="button" className={styles.priceMenuClose} onClick={() => dialog.current?.close()}>とじる</button></div>
      {links()}
    </dialog>
  </>;
}
