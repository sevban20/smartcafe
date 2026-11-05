"use client";

import * as React from "react";
import { Film, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/upload-client";
import { toast } from "sonner";

const MAX_MB = 60;

/** Acilis ekrani videosu: sikistirma yapilmaz, dosya oldugu gibi yuklenir. */
export function VideoPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error("Lütfen bir video dosyası seçin.");
    if (file.size > MAX_MB * 1024 * 1024) {
      return toast.error(`Video en fazla ${MAX_MB} MB olabilir. 10-20 saniyelik kısa bir video önerilir.`);
    }
    setBusy(true);
    setProgress(0);
    try {
      onChange(await uploadFile(file, "video", setProgress, file.name));
      toast.success("Video yüklendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video yüklenemedi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>Açılış videosu (isteğe bağlı)</Label>
      <div className="flex items-start gap-3">
        <div className="relative flex aspect-[9/16] w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {value ? (
            <video src={value} muted loop autoPlay playsInline className="h-full w-full object-cover" />
          ) : (
            <Film className="h-7 w-7 text-muted-foreground" />
          )}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/75 text-[11px] font-medium">
              <Loader2 className="h-5 w-5 animate-spin" />%{progress}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Video seç
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 className="h-4 w-4 text-destructive" />
                Kaldır
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sessiz ve döngüde oynar. Dikey, 10-20 saniyelik, {MAX_MB} MB altı bir MP4 en iyi sonucu verir. Video
            yüklenene kadar kapak görseli görünür.
          </p>
        </div>
      </div>
    </div>
  );
}
