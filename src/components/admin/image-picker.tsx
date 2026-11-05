"use client";

import * as React from "react";
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  /**
   * Uzun kenarin kucultulecegi deger. Urun detayinda fotograf telefon genisliginde
   * gosterildigi icin (retina ~1100 px) 1600 secildi.
   */
  maxEdge?: number;
  /** Logo gibi seffaf gorseller icin: JPEG'e cevirme */
  keepAlpha?: boolean;
  /** Onizleme kutusunun bicimi */
  previewClassName?: string;
};

/**
 * Gorsel secici: dosyayi kucultup sunucuya yukler (/uploads/...) ya da dis bir
 * baglanti kabul eder. Eskiden gorseller veritabanina gomuluyordu (data URL);
 * bu menunun her acilista megabaytlarca veri indirmesine yol aciyordu.
 */
export function ImagePicker({
  value,
  onChange,
  label = "Ürün görseli (isteğe bağlı)",
  hint,
  maxEdge = 1600,
  keepAlpha = false,
  previewClassName,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showUrl, setShowUrl] = React.useState(false);

  const isUploaded = value.startsWith("/uploads/");
  const isLegacy = value.startsWith("data:");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir görsel dosyası seçin.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const blob = await compressImage(file, maxEdge, keepAlpha);
      const url = await uploadFile(blob, "image", setProgress, file.name);
      onChange(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel yüklenemedi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
            previewClassName
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Görsel önizleme"
              className={cn("h-full w-full", keepAlpha ? "object-contain p-1" : "object-cover")}
            />
          ) : (
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
          )}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/75 text-[11px] font-medium">
              <Loader2 className="h-5 w-5 animate-spin" />
              {progress > 0 && `%${progress}`}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4" />
              Dosya seç
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowUrl((v) => !v)}>
              <Link2 className="h-4 w-4" />
              {showUrl ? "URL'yi gizle" : "URL ile ekle"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 className="h-4 w-4 text-destructive" />
                Kaldır
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {hint ??
              (isUploaded
                ? "Görsel yüklendi ve otomatik küçültüldü."
                : isLegacy
                  ? "Bu görsel eski yöntemle kayıtlı. Menü Görünümü ekranından toplu olarak taşıyabilirsin."
                  : "Telefondan fotoğraf çekip yükleyebilir ya da bir bağlantı yapıştırabilirsin.")}
          </p>

          {showUrl && (
            <Input
              placeholder="https://..."
              value={isUploaded || isLegacy ? "" : value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
