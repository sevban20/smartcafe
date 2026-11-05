"use client";

import * as React from "react";
import { Check, Coffee, Copy, Instagram, MapPin, Phone, Plus, Star, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryDTO, ProductDTO } from "@/types/menu";
import type { SiteSettingsDTO } from "@/lib/site-settings";
import { toast } from "sonner";

/** "₺ 190" bicimi: menude kurus gosterilmez (varsa gosterilir) */
const priceFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">₺</span>
      <span className="font-bold tabular-nums">{priceFmt.format(value)}</span>
    </span>
  );
}

/** Logo varsa logo, yoksa marka adi */
export function BrandMark({
  settings,
  className,
  textClassName,
}: {
  settings: SiteSettingsDTO;
  className?: string;
  textClassName?: string;
}) {
  if (settings.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={settings.logoUrl} alt={settings.brandName} className={cn("w-auto object-contain", className)} />;
  }
  return <span className={cn("truncate font-bold tracking-wide", textClassName)}>{settings.brandName}</span>;
}

/* ------------------------------------------------------------------ */
/* Urun karti                                                          */
/* ------------------------------------------------------------------ */

export function ProductCard({
  product,
  inCart,
  onOpen,
}: {
  product: ProductDTO;
  /** Sepetteki adet: 0 ise "+" gosterilir */
  inCart: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors active:bg-accent/40"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-bold leading-snug">{product.name}</p>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Price value={product.price} className="text-lg" />
          {product.options.length > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              Seçenekli
            </span>
          )}
        </div>
      </div>

      <div className="relative h-24 w-24 shrink-0">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full rounded-xl bg-muted object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Coffee className="h-7 w-7" />
          </div>
        )}
        <span
          className="absolute -bottom-1.5 -right-1.5 flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-1.5 text-sm font-bold text-primary-foreground shadow-md ring-2 ring-card"
          aria-hidden
        >
          {inCart > 0 ? inCart : <Plus className="h-4 w-4" />}
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Kategori karti (ana sayfa izgarasi)                                 */
/* ------------------------------------------------------------------ */

export function CategoryTile({ category, onOpen }: { category: CategoryDTO; onOpen: () => void }) {
  const count = category.products.length + category.children.reduce((s, c) => s + c.products.length, 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-56 overflow-hidden rounded-2xl bg-[var(--brand)] text-left shadow-sm"
    >
      {category.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={category.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
        />
      ) : (
        <Coffee className="absolute left-1/2 top-1/3 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[var(--brand-fg)] opacity-40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="text-base font-bold uppercase leading-tight tracking-wider text-white drop-shadow">
          {category.name}
        </h3>
        {category.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/80">{category.description}</p>
        )}
        <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-white/60">
          {category.children.length > 0 ? `${category.children.length} bölüm · ` : ""}
          {count} ürün
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Wi-Fi karti                                                         */
/* ------------------------------------------------------------------ */

export function WifiCard({ name, password, className }: { name: string; password: string | null; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Wi-Fi şifresi kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopyalanamadı, şifreyi elle yazabilirsiniz.");
    }
  };
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Wifi className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Wi-Fi</p>
        <p className="truncate text-sm font-semibold">{name}</p>
        {password && <p className="truncate font-mono text-sm text-muted-foreground">{password}</p>}
      </div>
      {password && (
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium active:bg-muted"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sosyal dugmeler                                                     */
/* ------------------------------------------------------------------ */

export function SocialButtons({ settings, className }: { settings: SiteSettingsDTO; className?: string }) {
  if (!settings.instagramUrl && !settings.googleReviewUrl) return null;
  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-colors active:bg-white/30";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {settings.instagramUrl && (
        <a href={settings.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram" className={btn}>
          <Instagram className="h-5 w-5" />
        </a>
      )}
      {settings.googleReviewUrl && (
        <a href={settings.googleReviewUrl} target="_blank" rel="noreferrer" aria-label="Google'da yorum yap" className={btn}>
          <Star className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sayfa alti                                                          */
/* ------------------------------------------------------------------ */

export function MenuFooter({ settings }: { settings: SiteSettingsDTO }) {
  return (
    <footer className="mt-10 bg-[var(--brand)] px-6 pb-32 pt-10 text-center text-[var(--brand-fg)]">
      <BrandMark settings={settings} className="mx-auto h-10" textClassName="text-2xl" />
      {settings.tagline && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] opacity-70">{settings.tagline}</p>
      )}
      {(settings.address || settings.phone) && (
        <div className="mt-5 space-y-1.5 text-sm opacity-80">
          {settings.address && (
            <p className="flex items-center justify-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {settings.address}
            </p>
          )}
          {settings.phone && (
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="flex items-center justify-center gap-1.5">
              <Phone className="h-4 w-4" />
              {settings.phone}
            </a>
          )}
        </div>
      )}
      {(settings.instagramUrl || settings.googleReviewUrl) && (
        <div className="mt-5 flex justify-center gap-3">
          {settings.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border [border-color:color-mix(in_srgb,currentColor_30%,transparent)] opacity-80"
            >
              <Instagram className="h-5 w-5" />
            </a>
          )}
          {settings.googleReviewUrl && (
            <a
              href={settings.googleReviewUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Google'da yorum yap"
              className="flex h-10 w-10 items-center justify-center rounded-full border [border-color:color-mix(in_srgb,currentColor_30%,transparent)] opacity-80"
            >
              <Star className="h-5 w-5" />
            </a>
          )}
        </div>
      )}
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Tam ekran kategori menusu (hamburger)                               */
/* ------------------------------------------------------------------ */

export function NavOverlay({
  open,
  onClose,
  settings,
  categories,
  activeId,
  onHome,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  settings: SiteSettingsDTO;
  categories: CategoryDTO[];
  activeId: string | null;
  onHome?: () => void;
  onSelect: (categoryId: string, subId?: string) => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kategoriler"
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--brand)] text-[var(--brand-fg)] duration-200 animate-in fade-in"
    >
      <div className="safe-top">
        <div className="flex h-14 items-center justify-between px-4">
          <BrandMark settings={settings} className="h-8" textClassName="text-lg" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-black/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      <nav className="space-y-1 px-6 pb-16 pt-4">
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            className="block py-2 text-left text-sm font-semibold uppercase tracking-[0.25em] opacity-60"
          >
            Ana sayfa
          </button>
        )}
        {categories.map((c) => (
          <div key={c.id} className="py-1.5">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "block text-left text-xl font-bold uppercase tracking-[0.15em] transition-opacity",
                activeId === c.id ? "opacity-100" : "opacity-60"
              )}
            >
              {c.name}
            </button>
            {c.children.length > 0 && (
              <div className="mt-1 space-y-0.5 border-l [border-color:color-mix(in_srgb,currentColor_30%,transparent)] pl-3">
                {c.children.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(c.id, s.id)}
                    className="block py-0.5 text-left text-sm opacity-70"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {settings.wifiName && (
          <div className="pt-6">
            <WifiCard
              name={settings.wifiName}
              password={settings.wifiPassword}
              className="border-transparent bg-white/95 text-neutral-900"
            />
          </div>
        )}
      </nav>
    </div>
  );
}
