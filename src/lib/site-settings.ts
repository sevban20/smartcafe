import { prisma } from "@/lib/prisma";

export type SiteSettingsDTO = {
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  brandColor: string;
  heroVideoUrl: string | null;
  heroImageUrl: string | null;
  welcomeText: string | null;
  instagramUrl: string | null;
  googleReviewUrl: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  phone: string | null;
  address: string | null;
};

export const DEFAULT_SETTINGS: SiteSettingsDTO = {
  brandName: "Çamlı Kahve",
  tagline: null,
  logoUrl: null,
  brandColor: "#8B5E3C",
  heroVideoUrl: null,
  heroImageUrl: null,
  welcomeText: "Hoş geldiniz! Siparişinizi buradan verebilirsiniz.",
  instagramUrl: null,
  googleReviewUrl: null,
  wifiName: null,
  wifiPassword: null,
  phone: null,
  address: null,
};

/** Ayar satiri henuz yoksa varsayilanlari dondurur (okurken satir olusturmaz). */
export async function getSiteSettings(): Promise<SiteSettingsDTO> {
  const row = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_SETTINGS;
  const { id: _id, updatedAt: _u, ...rest } = row;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Marka rengi -> tema degiskenleri                                    */
/* ------------------------------------------------------------------ */

export function normalizeHex(input: string | null | undefined, fallback = DEFAULT_SETTINGS.brandColor): string {
  const v = (input ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ("#" + v.slice(1).split("").map((c) => c + c).join("")).toUpperCase();
  return fallback;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** WCAG goreli parlaklik: acik renklerde yazi koyu, koyu renklerde beyaz olur */
function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function brandTheme(hexInput: string) {
  const hex = normalizeHex(hexInput);
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb);
  const lightBrand = luminance(rgb) > 0.45;
  return {
    hex,
    /** Tailwind'in hsl(var(--primary)) bicimi */
    primary: `${h} ${s}% ${l}%`,
    primaryForeground: lightBrand ? "25 25% 12%" : "0 0% 100%",
    /** Marka renginin cok acik tonu (vurgu zeminleri) */
    accent: `${h} ${Math.min(s, 45)}% 92%`,
    accentForeground: `${h} ${Math.min(s, 50)}% 20%`,
    foregroundOnBrand: lightBrand ? "#1F1A17" : "#FFFFFF",
  };
}

/**
 * Menu sayfalarina eklenen <style>: cekmeceler body'ye portal ile acildigi icin
 * degiskenler :root'a yazilir. Yalnizca menu sayfalarinda render edilir.
 */
export function brandCss(hex: string): string {
  const t = brandTheme(hex);
  return `:root{--primary:${t.primary};--primary-foreground:${t.primaryForeground};--ring:${t.primary};--accent:${t.accent};--accent-foreground:${t.accentForeground};--brand:${t.hex};--brand-fg:${t.foregroundOnBrand};}`;
}
