"use client";

import * as React from "react";
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/** Yuklenen gorsel bu genislige kadar kucultulur (kalite/boyut dengesi) */
const MAX_WIDTH = 800;
/** Veritabanina gomulecek data URL icin ust sinir (~350 KB) */
const MAX_DATA_URL_BYTES = 350_000;

/**
 * Secilen dosyayi canvas ile kucultup JPEG data URL'e cevirir.
 * Boyut sinirini asarsa kaliteyi kademeli dusurur.
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
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
