"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Coffee, Pencil, ReceiptText, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductDrawer } from "@/components/menu/product-drawer";
import { CartDrawer } from "@/components/menu/cart-drawer";
import { MyOrdersDrawer } from "@/components/menu/my-orders-drawer";
import { formatPrice } from "@/lib/utils";
import { cartCount, cartTotal, useCart } from "@/store/cart";
import type { CategoryDTO, ProductDTO } from "@/types/menu";

export function MenuClient({
  tableNo,
  categories,
  /** Garson modu: masa numarasi ekrandan degistirilebilir, ust bar personele gore gorunur */
  staffMode = false,
  staffName,
}: {
  tableNo: string;
  categories: CategoryDTO[];
  staffMode?: boolean;
  staffName?: string;
}) {
  const setTableNo = useCart((s) => s.setTableNo);
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = React.useState(false);
  const [activeProduct, setActiveProduct] = React.useState<ProductDTO | null>(null);
  const [productOpen, setProductOpen] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [ordersOpen, setOrdersOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState(categories[0]?.id ?? "");
  const [editingTable, setEditingTable] = React.useState(staffMode && !tableNo);
  const [tableDraft, setTableDraft] = React.useState(tableNo);
  const [currentTable, setCurrentTable] = React.useState(tableNo);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Masa degisince sepet sifirlanir (store icinde) — yanlis masaya siparis gitmesini onler
  React.useEffect(() => {
    if (currentTable) setTableNo(currentTable);
  }, [currentTable, setTableNo]);

  const openProduct = (product: ProductDTO) => {
    if (staffMode && !currentTable) {
      setEditingTable(true);
      return;
    }
    setActiveProduct(product);
    setProductOpen(true);
  };

  const scrollToCategory = (id: string) => {
    setActiveCategory(id);
    document.getElementById(`kat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const count = mounted ? cartCount(items) : 0;
  const total = mounted ? cartTotal(items) : 0;

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          {staffMode ? (
            <Button asChild variant="ghost" size="icon" aria-label="Sipariş ekranına dön">
              <Link href="/kds">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Coffee className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">
              {staffMode ? "Sipariş Al" : "SmartCafe"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {currentTable ? `Masa ${currentTable}` : "Masa seçilmedi"}
              {staffMode && staffName ? ` · ${staffName}` : ""}
            </p>
          </div>

          {staffMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditingTable(true)}>
              <Pencil className="h-4 w-4" />
              Masa
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOrdersOpen(true)}>
              <ReceiptText className="h-4 w-4" />
              Siparişlerim
            </Button>
          )}
        </div>

        {staffMode && editingTable && (
          <form
            className="flex items-center gap-2 border-t px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = tableDraft.trim();
              if (!value) return;
              setCurrentTable(value);
              setEditingTable(false);
            }}
          >
            <Input
              autoFocus
              inputMode="numeric"
              placeholder="Masa numarası"
              value={tableDraft}
              onChange={(e) => setTableDraft(e.target.value)}
            />
            <Button type="submit" disabled={!tableDraft.trim()}>
              <Check className="h-4 w-4" />
              Seç
            </Button>
          </form>
        )}

        {categories.length > 0 && (
          <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  activeCategory === cat.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="px-4">
        {categories.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Menü henüz hazırlanıyor. Lütfen personelimize danışın.
          </p>
        ) : (
          categories.map((cat) => (
            <section key={cat.id} id={`kat-${cat.id}`} className="scroll-mt-32 pt-5">
              <h2 className="mb-3 text-base font-bold">{cat.name}</h2>
              <div className="space-y-3">
                {cat.products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => openProduct(product)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors active:bg-accent/50"
                  >
                    {product.imageUrl ? (
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Coffee className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{product.name}</p>
                      {product.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                      )}
                      <p className="mt-1.5 font-semibold text-primary tabular-nums">{formatPrice(product.price)}</p>
                      {product.options.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">Seçenekler mevcut</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {count > 0 && currentTable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur safe-bottom">
          <Button size="lg" className="w-full justify-between" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Sepeti Görüntüle ({count})
            </span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </Button>
        </div>
      )}

      <ProductDrawer product={activeProduct} open={productOpen} onOpenChange={setProductOpen} />
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        tableNo={currentTable}
        staffMode={staffMode}
        onShowMyOrders={staffMode ? undefined : () => setOrdersOpen(true)}
      />
      {!staffMode && <MyOrdersDrawer open={ordersOpen} onOpenChange={setOrdersOpen} tableNo={currentTable} />}
    </div>
  );
}
