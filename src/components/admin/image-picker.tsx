"use client";

import * as React from "react";
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Yuklenen gorselin UZUN kenari bu degere kadar kucultulur. Urun detayinda
 * fotograf telefon genisliginde gosterildigi icin (retina ekranlarda ~1100 px)
 * 800 px yetmiyor, gorsel bulaniklasiyordu.
 */
const MAX_EDGE = 1200;
/** Veritabanina gomulecek data URL icin ust sinir (~450 KB) */
const MAX_DATA_URL_BYTES = 450_000;

/**
 * Secilen dosyayi canvas ile kucultup JPEG data URL'e cevirir.
 * Boyut sinirini asarsa kaliteyi kademeli dusurur.
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi.");
  // PNG seffafligi JPEG'de siyaha donmesin
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.86, 0.8, 0.72, 0.65]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_URL_BYTES) return dataUrl;
  }
  // Kaliteyi daha fazla dusurup fotografi bozmak yerine boyutu kucult
  const half = document.createElement("canvas");
  half.width = Math.round(width * 0.75);
  half.height = Math.round(height * 0.75);
  const hctx = half.getContext("2d");
  if (hctx) {
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(canvas, 0, 0, half.width, half.height);
    const dataUrl = half.toDataURL("image/jpeg", 0.8);
    if (dataUrl.length <= MAX_DATA_URL_BYTES) return dataUrl;
  }
  throw new Error("Görsel çok büyük. Daha küçük bir dosya deneyin.");
}

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function ImagePicker({ value, onChange }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [showUrl, setShowUrl] = React.useState(false);

  const isUploaded = value.startsWith("data:");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir görsel dosyası seçin.");
      return;
    }
    setBusy(true);
    try {
      onChange(await fileToCompressedDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel yüklenemedi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>Ürün görseli (isteğe bağlı)</Label>

      <div className="flex items-start gap-3">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Ürün görseli önizleme" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
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
            {isUploaded
              ? "Yüklenen görsel otomatik küçültüldü ve ürüne gömüldü."
              : "Telefondan fotoğraf çekip yükleyebilir ya da bir bağlantı yapıştırabilirsin."}
          </p>

          {showUrl && (
            <Input
              placeholder="https://..."
              value={isUploaded ? "" : value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
