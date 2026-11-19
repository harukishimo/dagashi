"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";

import styles from "@/components/admin/admin.module.css";
import type { Product } from "@/domain/types";
import { selectProducts, type ProductSort } from "@/domain/product-list";

type AdminProduct = Omit<Product, "imageFileId"> & {
  imageConfigured: boolean;
  imageUrl: string | null;
};

interface ProductForm {
  stockQuantity: string;
  name: string;
  priceYen: string;
  category: string;
  fallbackEmoji: string;
  imageSource: string;
  displayOrder: string;
  status: Product["status"];
  removeImage: boolean;
}

const EMPTY_FORM: ProductForm = { stockQuantity: "0", name: "", priceYen: "", category: "", fallbackEmoji: "", imageSource: "", displayOrder: "0", status: "draft", removeImage: false };

const STATUS_LABEL: Record<Product["status"], string> = { draft: "下書き", active: "販売中", sold_out: "売切", hidden: "非表示" };

function formFromProduct(product: AdminProduct): ProductForm {
  return {
    name: product.name,
    stockQuantity: product.stockQuantity == null ? "" : String(Math.max(0, product.stockQuantity)),
    priceYen: String(product.priceYen),
    category: product.category,
    fallbackEmoji: product.fallbackEmoji,
    imageSource: "",
    displayOrder: String(product.displayOrder),
    status: product.status,
    removeImage: false,
  };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState("");
  const [statuses, setStatuses] = useState<Product["status"][]>([]);
  const [sort, setSort] = useState<ProductSort>("price_asc");
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [stockBaseline, setStockBaseline] = useState<AdminProduct[]>([]);
  const changedStocks = stockBaseline.filter(product => {
    const draft = stockDrafts[product.productId];
    return draft !== undefined && (draft === "" ? null : Number(draft)) !== (product.stockQuantity ?? null);
  });
  const visibleProducts = selectProducts(products, { query, price, statuses, sort });
  const prices = [...new Set(products.map(product => product.priceYen))].sort((a, b) => a - b);

  async function load(): Promise<AdminProduct[]> {
    const response = await fetch("/api/admin/products", { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || "読込に失敗しました");
    const loaded = payload.products as AdminProduct[];
    setProducts(loaded);
    return loaded;
  }

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読込に失敗しました"));
  }, []);

  function startEdit(product: AdminProduct): void {
    setEditingProduct(product);
    setForm(formFromProduct(product));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicate(product: AdminProduct): void {
    setEditingProduct(null);
    setForm({ ...formFromProduct(product), name: `${product.name}（コピー）`, imageSource: "", status: "draft" });
    setMessage("複製元を入力欄にセットしました。内容を確認して保存してください。");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit(): void {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const input: Record<string, unknown> = {
        name: form.name,
        priceYen: Number(form.priceYen),
        category: form.category,
        fallbackEmoji: form.fallbackEmoji,
        displayOrder: Number(form.displayOrder),
        status: form.status,
      };
      if (!editingProduct || form.stockQuantity !== formFromProduct(editingProduct).stockQuantity) {
        input.stockQuantity = form.stockQuantity === "" ? null : Number(form.stockQuantity);
      }
      if (editingProduct) {
        // An empty source on edit preserves the existing Drive image. Explicitly checking
        // removeImage is the only way to clear it, preventing accidental image loss.
        input.imageSource = form.removeImage ? null : form.imageSource.trim() || undefined;
      } else {
        input.imageSource = form.imageSource.trim() || null;
      }
      const endpoint = editingProduct ? `/api/admin/products/${encodeURIComponent(editingProduct.productId)}` : "/api/admin/products";
      const response = await fetch(endpoint, {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "content-type": "application/json", Origin: window.location.origin },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "保存に失敗しました");
      setMessage(payload.imageWarning || (editingProduct ? "商品を更新しました" : "商品を登録しました"));
      setEditingProduct(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存に失敗しました");
    } finally {
      setPending(false);
    }
  }

  function imageFailed(productId: string): void {
    setFailedImages((previous) => new Set(previous).add(productId));
  }

  async function startBulkEdit(): Promise<void> {
    setBulkPending(true); setError(""); setMessage("");
    try {
      const latest = await load();
      setStockBaseline(latest);
      setStockDrafts(Object.fromEntries(latest.map(product => [product.productId, product.stockQuantity == null ? "" : String(Math.max(0, product.stockQuantity))])));
      setQuery(""); setPrice(""); setStatuses([]);
      cancelEdit(); setBulkEditing(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "在庫を読み込めませんでした"); }
    finally { setBulkPending(false); }
  }

  async function saveBulkStock(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!changedStocks.length) return;
    setBulkPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/products/stock", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: changedStocks.map(product => ({ productId: product.productId, stockQuantity: stockDrafts[product.productId] === "" ? null : Number(stockDrafts[product.productId]), expectedStockQuantity: product.stockQuantity ?? null, expectedUpdatedAt: product.updatedAt })) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "保存できませんでした");
      setBulkEditing(false); setStockDrafts({}); setStockBaseline([]);
      setMessage(payload.data.warning || `${payload.data.updatedCount}商品の在庫を保存しました`);
      try { await load(); } catch { setError("在庫は保存しました。最新の在庫を確認ボタンで表示を更新してください"); }
    } catch (cause) { setError(`${cause instanceof Error ? cause.message : "通信エラーです"}。保存結果が不明なときは、一括編集を閉じて最新の在庫を確認してください。`); }
    finally { setBulkPending(false); }
  }

  return <>
    <header className={styles.header}><h1>商品マスタ・在庫管理</h1><button className={styles.button} disabled={bulkEditing || bulkPending} onClick={() => load().catch(() => setError("在庫を更新できませんでした"))}>最新の在庫を確認</button></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}
    {!bulkEditing && <section className={styles.panel}>
      <h2>{editingProduct ? `商品を編集：${editingProduct.name}` : "商品を追加"}</h2>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.label}>現在庫（個・空欄は在庫管理なし）<input className={styles.input} type="number" min="0" max="999999" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} /></label>
        <p>入荷・棚卸し時は、いま実際にある個数を入力してください。売上と特典交換で自動的に減り、売上取消で戻ります。会計中の変更は避けてください。</p>
        <label className={styles.label}>商品名<input className={styles.input} required maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className={styles.label}>価格（円）<input className={styles.input} required type="number" min="0" max="999999" value={form.priceYen} onChange={(event) => setForm({ ...form, priceYen: event.target.value })} /></label>
        <label className={styles.label}>カテゴリ<input className={styles.input} maxLength={30} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
        <label className={styles.label}>フォールバック絵文字（販売中は必須）<input className={styles.input} required={form.status === "active"} maxLength={16} value={form.fallbackEmoji} onChange={(event) => setForm({ ...form, fallbackEmoji: event.target.value })} /></label>
        <label className={styles.label}>Drive file_id または共有URL（任意）<input className={styles.input} value={form.imageSource} onChange={(event) => setForm({ ...form, imageSource: event.target.value })} /></label>
        {editingProduct?.imageConfigured && <label className={styles.label}><span>既存のDrive画像を解除する</span><input type="checkbox" checked={form.removeImage} onChange={(event) => setForm({ ...form, removeImage: event.target.checked })} /></label>}
        <label className={styles.label}>表示順<input className={styles.input} required type="number" min="0" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} /></label>
        <label className={styles.label}>状態<select className={styles.select} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Product["status"] })}><option value="draft">下書き</option><option value="active">販売中</option><option value="sold_out">売切</option><option value="hidden">非表示</option></select></label>
        <div className={styles.actionRow}>
          <button className={styles.button} type="submit" disabled={pending}>{pending ? "保存中…" : editingProduct ? "変更を保存" : "商品を保存"}</button>
          {editingProduct && <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={cancelEdit} disabled={pending}>編集をやめる</button>}
        </div>
      </form>
    </section>}
    <section className={styles.panel} style={{ marginTop: 24 }}>
      <div className={styles.header}><h2>登録済み商品・在庫一覧</h2>{!bulkEditing && <button className={styles.button} type="button" disabled={bulkPending || pending} onClick={() => void startBulkEdit()}>{bulkPending ? "在庫を読み込み中…" : "在庫を一括編集"}</button>}</div>
      {bulkEditing && <form id="bulk-stock-form" className={styles.bulkToolbar} onSubmit={saveBulkStock}>
        <div><strong>現在庫をまとめて編集</strong><p>いま実際にある個数を入力してください。空欄は在庫管理なしです。会計を止めてから保存してください。</p><span role="status">変更：{changedStocks.length}商品</span></div>
        <div className={styles.actionRow}><button className={styles.button} disabled={bulkPending || !changedStocks.length}>{bulkPending ? "一括保存中…" : "在庫を一括保存"}</button><button className={`${styles.button} ${styles.buttonSecondary}`} type="button" disabled={bulkPending} onClick={() => { setBulkEditing(false); setStockDrafts({}); setStockBaseline([]); setError(""); }}>キャンセル</button></div>
      </form>}
      <div className={styles.filters} role="search" aria-label="商品マスタ検索">
        <label className={styles.label}>商品名で検索<input className={styles.input} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="名前の一部で検索" /></label>
        <label className={styles.label}>販売価格<select className={styles.select} value={price} onChange={event => setPrice(event.target.value)}><option value="">すべての価格</option>{prices.map(value => <option key={value} value={value}>{value.toLocaleString()}円</option>)}</select></label>
        <label className={styles.label}>並び順<select className={styles.select} value={sort} onChange={event => setSort(event.target.value as ProductSort)}><option value="price_asc">販売価格が安い順</option><option value="price_desc">販売価格が高い順</option><option value="display_order">表示順</option><option value="name">商品名順</option><option value="updated_desc">更新日時が新しい順</option></select></label>
        <fieldset className={styles.filterStatuses}><legend>ステータス（複数選択可・未選択はすべて）</legend>{(Object.keys(STATUS_LABEL) as Product["status"][]).map(status => <label key={status} className={styles.choice}><input type="checkbox" checked={statuses.includes(status)} onChange={event => setStatuses(current => event.target.checked ? [...current, status] : current.filter(value => value !== status))} />{STATUS_LABEL[status]}</label>)}</fieldset>
        <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={() => { setQuery(""); setPrice(""); setStatuses([]); setSort("price_asc"); }}>検索条件をリセット</button>
      </div>
      <p role="status">{products.length}件中 {visibleProducts.length}件を表示</p>
      <p>名前・価格・ステータスを組み合わせて検索できます。一覧の並び替えは子ども画面の表示順には影響しません。</p>
      {bulkEditing && <p>絞り込みで見えなくなった商品も、変更した在庫は一緒に保存されます。</p>}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>商品</th><th>画像</th><th>価格</th><th>状態</th><th>現在庫</th><th>操作</th></tr></thead><tbody>
        {visibleProducts.map((product) => {
          const showImage = product.imageUrl && !failedImages.has(product.productId);
          return <tr key={product.productId}>
            <td><div className={styles.productCell}><span className={styles.productThumb}>{showImage ? <Image src={product.imageUrl ?? ""} width={42} height={42} sizes="42px" unoptimized alt="" onError={() => imageFailed(product.productId)} /> : product.fallbackEmoji || "🍬"}</span><span>{product.name}</span></div></td>
            <td>{showImage ? "Drive画像" : product.imageConfigured ? <span title="画像を読み込めないため絵文字で表示中">絵文字（要確認）</span> : "絵文字"}</td>
            <td>{product.priceYen.toLocaleString()}円</td>
            <td>{STATUS_LABEL[product.status]}</td>
            <td>{bulkEditing ? <input form="bulk-stock-form" className={`${styles.input} ${styles.stockInput}`} aria-label={`${product.name}の現在庫`} type="number" inputMode="numeric" min={0} max={999999} step={1} value={stockDrafts[product.productId] ?? ""} disabled={bulkPending} onChange={event => setStockDrafts(current => ({ ...current, [product.productId]: event.target.value }))} /> : <>在庫：{product.stockQuantity == null ? "未設定" : `${product.stockQuantity}個`}{product.stockQuantity != null && product.stockQuantity <= 0 && <strong>（売り切れ）</strong>}</>}</td>
            <td><div className={styles.actionRow}><button className={`${styles.button} ${styles.buttonSecondary}`} type="button" disabled={bulkEditing || bulkPending} onClick={() => startEdit(product)}>編集</button><button className={`${styles.button} ${styles.buttonSecondary}`} type="button" disabled={bulkEditing || bulkPending} onClick={() => duplicate(product)}>複製</button></div></td>
          </tr>;
        })}
      </tbody></table></div>
      {visibleProducts.length === 0 && <p>条件に一致する商品はありません。検索条件を変更してください。</p>}
      <p className={styles.notice} style={{ marginTop: 16 }}>削除は行わず、状態を「非表示」に変更して管理します。Drive画像が取得できない商品は絵文字に切り替わり、要確認として表示します。</p>
    </section>
  </>;
}
