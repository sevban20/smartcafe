"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
  Pencil,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductDrawer } from "@/components/menu/product-drawer";
import { CartDrawer } from "@/components/menu/cart-drawer";
import { MyOrdersDrawer } from "@/components/menu/my-orders-drawer";
import {
  BrandMark,
  CategoryTile,
  MenuFooter,
  NavOverlay,
  ProductCard,
  SocialButtons,
  WifiCard,
} from "@/components/menu/menu-parts";
import { cn, formatPrice } from "@/lib/utils";
import { cartCount, cartTotal, useCart } from "@/store/cart";
import type { SiteSettingsDTO } from "@/lib/site-settings";
import type { CategoryDTO, ProductDTO } from "@/types/menu";

/**
 * QR menu. Iki gorunum:
 *  - Ana sayfa (yalnizca musteri): acilis videosu/gorseli, Wi-Fi, kategori kartlari
 *  - Kategori: sabit ust bar + kategori sekmeleri + alt kategori basliklari + urunler
 * Hangi kategoride olundugu adreste (?k=...) tutulur; telefonun geri tusu calisir.
 * Sepet, urun secenekleri ve siparis akisi eskisi gibi.
 */
export function MenuClient({
  tableNo,
  categories,
  settings,
  /** Garson modu: masa numarasi ekrandan degistirilebilir, acilis ekrani yok */
  staffMode = false,
  staffName,
}: {
  tableNo: string;
  categories: CategoryDTO[];
  settings: SiteSettingsDTO;
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
  const [navOpen, setNavOpen] = React.useState(false);
  const [editingTable, setEditingTable] = React.useState(staffMode && !tableNo);
  const [tableDraft, setTableDraft] = React.useState(tableNo);
  const [currentTable, setCurrentTable] = React.useState(tableNo);

  /** null = ana sayfa */
  const [view, setView] = React.useState<string | null>(staffMode ? (categories[0]?.id ?? null) : null);
  const pendingSub = React.useRef<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Masa degisince sepet sifirlanir (store icinde) — yanlis masaya siparis gitmesini onler
  React.useEffect(() => {
    if (currentTable) setTableNo(currentTable);
  }, [currentTable, setTableNo]);

  /* ---------------- adres <-> gorunum ---------------- */

  const validId = React.useCallback((id: string | null) => !!id && categories.some((c) => c.id === id), [categories]);

  React.useEffect(() => {
    if (staffMode) return;
    const sync = () => {
      const k = new URLSearchParams(window.location.search).get("k");
      setView(validId(k) ? k : null);
      setNavOpen(false);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [staffMode, validId]);

  const openCategory = (id: string, subId?: string) => {
    setNavOpen(false);
    pendingSub.current = subId ?? null;
    if (!staffMode) {
      const url = `${window.location.pathname}?k=${encodeURIComponent(id)}`;
      // Ana sayfadan girerken gecmise ekle (geri tusu ana sayfaya donsun); kategoriler arasi gecis gecmisi sisirmesin
      if (view === null) window.history.pushState({ k: id }, "", url);
      else window.history.replaceState({ k: id }, "", url);
    }
    if (id === view && subId) {
      scrollToSub(subId);
      return;
    }
    setView(id);
    if (!subId) window.scrollTo({ top: 0 });
  };

  const goHome = () => {
    setNavOpen(false);
    if (staffMode) return;
    if (window.history.state?.k) window.history.back();
    else {
      window.history.replaceState(null, "", window.location.pathname);
      setView(null);
    }
    window.scrollTo({ top: 0 });
  };

  /* ---------------- sabit ust alan yuksekligi ---------------- */

  const headRef = React.useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = React.useState(120);
  React.useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeadH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const scrollToSub = React.useCallback(
    (subId: string) => {
      const el = document.getElementById(`alt-${subId}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - headH - 8;
      window.scrollTo({ top, behavior: "smooth" });
    },
    [headH]
  );

  // Kategori acildiktan sonra istenen alt kategoriye in
  React.useEffect(() => {
    if (view && pendingSub.current) {
      const sub = pendingSub.current;
      pendingSub.current = null;
      requestAnimationFrame(() => scrollToSub(sub));
    }
  }, [view, scrollToSub]);

  /* ---------------- secili kategori + gorunen alt kategori ---------------- */

  const category = view ? (categories.find((c) => c.id === view) ?? null) : null;
  const catIndex = category ? categories.indexOf(category) : -1;
  const nextCategory = catIndex >= 0 ? categories[catIndex + 1] : undefined;
  const [activeSub, setActiveSub] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActiveSub(null);
    if (!category || category.children.length === 0) return;
    const els = category.children
      .map((c) => document.getElementById(`alt-${c.id}`))
      .filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSub(visible[0].target.id.replace("alt-", ""));
      },
      { rootMargin: `-${Math.round(headH + 10)}px 0px -55% 0px` }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [category, headH]);

  // Secili sekme ve alt kategori cipi gorunur alanda kalsin
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useEffect(() => {
    if (view) tabRefs.current.get(view)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [view]);
  const subRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useEffect(() => {
    if (activeSub) subRefs.current.get(activeSub)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeSub]);

  /* ---------------- urun / sepet ---------------- */

  const openProduct = (product: ProductDTO) => {
    if (staffMode && !currentTable) {
      setEditingTable(true);
      return;
    }
    setActiveProduct(product);
    setProductOpen(true);
  };

  const count = mounted ? cartCount(items) : 0;
  const total = mounted ? cartTotal(items) : 0;
  const inCart = React.useMemo(() => {
    const m = new Map<string, number>();
    if (mounted) for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    return m;
  }, [items, mounted]);

  const productList = (products: ProductDTO[]) => (
    <div className="space-y-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} inCart={inCart.get(p.id) ?? 0} onOpen={() => openProduct(p)} />
      ))}
    </div>
  );

  /* ================================================================== */

  const staffBar = (
    <div className="border-b bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button asChild variant="ghost" size="icon" aria-label="Sipariş ekranına dön">
          <Link href="/kds">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">Sipariş Al</h1>
          <p className="truncate text-xs text-muted-foreground">
            {currentTable ? `Masa ${currentTable}` : "Masa seçilmedi"}
            {staffName ? ` · ${staffName}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditingTable(true)}>
          <Pencil className="h-4 w-4" />
          Masa
        </Button>
      </div>
      {editingTable && (
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
    </div>
  );

  const customerBar = (
    <div className="bg-[var(--brand)] text-[var(--brand-fg)]">
      <div className="flex h-14 items-center gap-1 px-1.5">
        <button
          type="button"
          onClick={goHome}
          aria-label="Ana sayfa"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-black/10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={goHome} className="flex min-w-0 flex-1 items-center">
          <BrandMark settings={settings} className="h-8 max-w-[160px]" textClassName="text-lg" />
        </button>
        {currentTable && (
          <span className="shrink-0 rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold">Masa {currentTable}</span>
        )}
        <button
          type="button"
          onClick={() => setOrdersOpen(true)}
          aria-label="Siparişlerim"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-black/10"
        >
          <ReceiptText className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Kategoriler"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-black/10"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      {view === null ? (
        /* ============================ ANA SAYFA ============================ */
        <HomeView
          settings={settings}
          categories={categories}
          tableNo={currentTable}
          onOpenCategory={openCategory}
          onShowOrders={() => setOrdersOpen(true)}
        />
      ) : (
        /* ============================ KATEGORI ============================ */
        <>
          <div ref={headRef} className="sticky top-0 z-30 shadow-sm">
            <div className={staffMode ? "safe-top bg-background" : "safe-top bg-[var(--brand)]"}>
              {staffMode ? staffBar : customerBar}
            </div>

            <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b bg-background/95 px-2 backdrop-blur">
              {categories.map((c) => (
                <button
                  key={c.id}
                  ref={(el) => {
                    if (el) tabRefs.current.set(c.id, el);
                    else tabRefs.current.delete(c.id);
                  }}
                  type="button"
                  onClick={() => openCategory(c.id)}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wider transition-colors",
                    c.id === view ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {c.name}
                  {c.id === view && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
                </button>
              ))}
            </nav>

            {category && category.children.length > 0 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur">
                {category.children.map((s) => (
                  <button
                    key={s.id}
                    ref={(el) => {
                      if (el) subRefs.current.set(s.id, el);
                      else subRefs.current.delete(s.id);
                    }}
                    type="button"
                    onClick={() => scrollToSub(s.id)}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      activeSub === s.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <main className="pb-32">
            {!category ? (
              <p className="py-20 text-center text-sm text-muted-foreground">
                Menü henüz hazırlanıyor. Lütfen personelimize danışın.
              </p>
            ) : (
              <>
                <CategoryBanner category={category} />

                <div className="space-y-8 px-4 pt-4">
                  {category.products.length > 0 && productList(category.products)}

                  {category.children.map((sub) => (
                    <section key={sub.id} id={`alt-${sub.id}`}>
                      <div className="mb-3">
                        <h3 className="text-lg font-bold">{sub.name}</h3>
                        {sub.description && <p className="mt-0.5 text-sm text-muted-foreground">{sub.description}</p>}
                      </div>
                      {productList(sub.products)}
                    </section>
                  ))}

                  {nextCategory && (
                    <button
                      type="button"
                      onClick={() => openCategory(nextCategory.id)}
                      className="flex w-full items-center justify-between rounded-2xl border border-dashed p-4 text-left active:bg-muted"
                    >
                      <span>
                        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
                          Sıradaki kategori
                        </span>
                        <span className="font-semibold">{nextCategory.name}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </>
            )}
          </main>
        </>
      )}

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

      <NavOverlay
        open={navOpen}
        onClose={() => setNavOpen(false)}
        settings={settings}
        categories={categories}
        activeId={view}
        onHome={staffMode ? undefined : goHome}
        onSelect={openCategory}
      />
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

/* ------------------------------------------------------------------ */
/* Kategori basligi                                                    */
/* ------------------------------------------------------------------ */

function CategoryBanner({ category }: { category: CategoryDTO }) {
  if (!category.imageUrl) {
    return (
      <div className="px-4 pt-5">
        <h2 className="text-2xl font-bold uppercase tracking-wide">{category.name}</h2>
        {category.description && <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>}
      </div>
    );
  }
  return (
    <div className="px-4 pt-4">
      <div className="relative h-40 overflow-hidden rounded-2xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={category.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-white drop-shadow">{category.name}</h2>
          {category.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-white/85">{category.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ana sayfa                                                           */
/* ------------------------------------------------------------------ */

function HomeView({
  settings,
  categories,
  tableNo,
  onOpenCategory,
  onShowOrders,
}: {
  settings: SiteSettingsDTO;
  categories: CategoryDTO[];
  tableNo: string;
  onOpenCategory: (id: string) => void;
  onShowOrders: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // iPhone'da otomatik oynatma icin video sessiz olmali; React "muted" ozelligini
  // sunucu HTML'ine yazmadigi icin burada elle ayarlaniyor.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {
      /* dusuk guc modunda oynatma engellenebilir; kapak gorseli gorunur */
    });
  }, [settings.heroVideoUrl]);

  const scrollToMenu = () =>
    document.getElementById("kategoriler")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <section className="relative flex h-[82svh] min-h-[480px] flex-col overflow-hidden bg-[var(--brand)] text-white">
        {settings.heroVideoUrl ? (
          <video
            ref={videoRef}
            src={settings.heroVideoUrl}
            poster={settings.heroImageUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : settings.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/75" />

        <div className="safe-top relative z-10">
          <div className="flex items-start justify-between p-4">
            {tableNo ? (
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                Masa {tableNo}
              </span>
            ) : (
              <span />
            )}
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={onShowOrders}
                className="flex h-10 items-center gap-1.5 rounded-full bg-white/20 px-3.5 text-xs font-semibold backdrop-blur-md active:bg-white/30"
              >
                <ReceiptText className="h-4 w-4" />
                Siparişlerim
              </button>
              <SocialButtons settings={settings} />
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto flex flex-col items-center px-6 pb-12 text-center">
          <BrandMark
            settings={settings}
            className="h-20 max-w-[240px] drop-shadow-lg"
            textClassName="text-4xl drop-shadow-lg"
          />
          {settings.tagline && (
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.35em] text-white/80">{settings.tagline}</p>
          )}
          {settings.welcomeText && <p className="mt-4 max-w-xs text-sm text-white/90">{settings.welcomeText}</p>}
          <button
            type="button"
            onClick={scrollToMenu}
            className="mt-6 rounded-lg bg-primary px-8 py-4 text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground shadow-lg active:opacity-90"
          >
            Menüyü Gör
          </button>
        </div>
      </section>

      {settings.wifiName && (
        <div className="relative z-10 -mt-6 px-4">
          <WifiCard name={settings.wifiName} password={settings.wifiPassword} />
        </div>
      )}

      <section id="kategoriler" className="scroll-mt-4 px-4 pt-8">
        <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.35em] text-muted-foreground">Menü</h2>
        {categories.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Menü henüz hazırlanıyor. Lütfen personelimize danışın.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categories.map((c) => (
              <CategoryTile key={c.id} category={c} onOpen={() => onOpenCategory(c.id)} />
            ))}
          </div>
        )}
      </section>

      <MenuFooter settings={settings} />
    </>
  );
}
