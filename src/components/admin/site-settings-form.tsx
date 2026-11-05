"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageUp, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/admin/image-picker";
import { VideoPicker } from "@/components/admin/video-picker";
import { migrateInlineImages, saveSiteSettings } from "@/app/yonetim/menu/gorunum/actions";
import type { SiteSettingsDTO } from "@/lib/site-settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Draft = { [K in keyof SiteSettingsDTO]: string };

const toDraft = (s: SiteSettingsDTO): Draft =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ""])) as Draft;

/** Hazir renkler: kahve tonlari agirlikli, birkac farkli secenek */
const PRESETS = ["#8B5E3C", "#CFAE8A", "#6F4E37", "#2F3E46", "#1F4D3A", "#7A1F2B", "#C2410C", "#111827"];

export function SiteSettingsForm({
  initial,
  inlineImageCount,
}: {
  initial: SiteSettingsDTO;
  inlineImageCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(initial));
  const [saving, setSaving] = React.useState(false);
  const [migrating, setMigrating] = React.useState(false);

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const input = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value),
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(initial));
  const colorValid = /^#[0-9a-fA-F]{6}$/.test(draft.brandColor);

  const submit = async () => {
    setSaving(true);
    const res = await saveSiteSettings(draft);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Menü görünümü kaydedildi");
    router.refresh();
  };

  const migrate = async () => {
    setMigrating(true);
    const res = await migrateInlineImages();
    setMigrating(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${res.moved} görsel taşındı` + (res.failed ? ` · ${res.failed} görsel okunamadı` : ""));
    router.refresh();
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Menü yönetimine dön">
            <Link href="/yonetim/menu">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Menü Görünümü</h1>
            <p className="text-sm text-muted-foreground">Müşterinin QR ile açtığı menünün logosu, rengi ve açılış ekranı</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <a href="/menu" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Menüyü aç
          </a>
        </Button>
      </div>

      {inlineImageCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">{inlineImageCount} ürün görseli eski yöntemle kayıtlı</p>
              <p className="text-xs text-amber-900/80">
                Bu görseller veritabanının içinde duruyor ve menüyü yavaşlatıyor. Dosyaya taşınınca menü çok daha
                hızlı açılır; görseller değişmez.
              </p>
            </div>
            <Button onClick={migrate} disabled={migrating} variant="outline" className="bg-background">
              {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
              Görselleri taşı
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Marka</CardTitle>
            <CardDescription>Menünün üst barında ve açılış ekranında görünür.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ay-marka">Marka adı</Label>
              <Input id="ay-marka" placeholder="Örn. Çamlı Kahve" {...input("brandName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ay-slogan">Slogan</Label>
              <Input id="ay-slogan" placeholder="Örn. Kahve · Tatlı · Kahvaltı" {...input("tagline")} />
            </div>
            <ImagePicker
              label="Logo (isteğe bağlı)"
              value={draft.logoUrl}
              onChange={set("logoUrl")}
              keepAlpha
              maxEdge={800}
              previewClassName="w-32 bg-neutral-800"
              hint="Şeffaf arka planlı PNG önerilir. Logo yoksa marka adı yazı olarak görünür."
            />

            <div className="space-y-2">
              <Label>Marka rengi</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => set("brandColor")(c)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      draft.brandColor.toUpperCase() === c ? "scale-110 border-foreground" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border">
                  <input
                    type="color"
                    className="absolute -inset-2 h-12 w-12 cursor-pointer"
                    value={colorValid ? draft.brandColor : "#8B5E3C"}
                    onChange={(e) => set("brandColor")(e.target.value.toUpperCase())}
                    aria-label="Özel renk seç"
                  />
                </label>
                <Input className="w-28 font-mono text-sm uppercase" maxLength={7} {...input("brandColor")} />
              </div>
              <div
                className="flex h-11 items-center justify-between rounded-lg px-4 text-sm font-semibold"
                style={{ backgroundColor: colorValid ? draft.brandColor : undefined }}
              >
                <span className="rounded bg-white/90 px-2 py-0.5 text-xs text-neutral-900">Önizleme</span>
                <span className="rounded bg-black/20 px-2 py-0.5 text-xs text-white">Üst bar ve düğmeler</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Açılış ekranı</CardTitle>
            <CardDescription>QR okutulunca ilk görünen tam ekran alan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <VideoPicker value={draft.heroVideoUrl} onChange={set("heroVideoUrl")} />
            <ImagePicker
              label="Kapak görseli"
              value={draft.heroImageUrl}
              onChange={set("heroImageUrl")}
              maxEdge={1600}
              previewClassName="aspect-[9/16] h-auto w-24"
              hint="Video yoksa arka plan olur; video varsa video yüklenene kadar görünür."
            />
            <div className="space-y-1.5">
              <Label htmlFor="ay-hosgeldin">Karşılama yazısı</Label>
              <Textarea id="ay-hosgeldin" rows={2} placeholder="Örn. Hoş geldiniz!" {...input("welcomeText")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wi-Fi</CardTitle>
            <CardDescription>Doldurulursa menüde kopyalanabilir bir Wi-Fi kartı görünür.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ay-wifi">Ağ adı</Label>
              <Input id="ay-wifi" autoComplete="off" {...input("wifiName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ay-wifi-sifre">Şifre</Label>
              <Input id="ay-wifi-sifre" autoComplete="off" {...input("wifiPassword")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İletişim ve sosyal medya</CardTitle>
            <CardDescription>Açılış ekranındaki düğmeler ve sayfa altı.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ay-ig">Instagram bağlantısı</Label>
              <Input id="ay-ig" type="url" placeholder="https://instagram.com/..." {...input("instagramUrl")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ay-google">Google yorum bağlantısı</Label>
              <Input
                id="ay-google"
                type="url"
                placeholder="https://g.page/r/.../review"
                {...input("googleReviewUrl")}
              />
              <p className="text-[11px] text-muted-foreground">
                Google İşletme Profili → &ldquo;Yorum iste&rdquo; bölümündeki bağlantıyı yapıştır.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ay-tel">Telefon</Label>
                <Input id="ay-tel" type="tel" {...input("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ay-adres">Adres</Label>
                <Input id="ay-adres" {...input("address")} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 p-3 backdrop-blur md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {dirty && <span className="text-xs text-muted-foreground">Kaydedilmemiş değişiklikler var</span>}
          <Button onClick={submit} disabled={saving || !dirty || !draft.brandName.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}
