"use client";

/** /api/upload'a dosya gonderir; ilerleme yuzdesi icin XHR kullanir. */
export function uploadFile(
  file: Blob,
  kind: "image" | "video",
  onProgress?: (percent: number) => void,
  filename = "dosya"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, filename);
    form.append("kind", kind);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json: { url?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* bos */
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.url) resolve(json.url);
      else if (xhr.status === 413) reject(new Error(json.error ?? "Dosya çok büyük."));
      else reject(new Error(json.error ?? "Yükleme başarısız."));
    };
    xhr.onerror = () => reject(new Error("Bağlantı hatası, yükleme yapılamadı."));
    xhr.send(form);
  });
}

/**
 * Gorseli tarayicida kucultup yeniden kodlar (telefon fotograflari 5-10 MB olabiliyor).
 * keepAlpha: logo gibi seffaf gorseller PNG/WEBP kalir; digerleri JPEG olur.
 */
export async function compressImage(file: File, maxEdge: number, keepAlpha = false): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi.");
  if (!keepAlpha) {
    // Seffaf PNG, JPEG'de siyaha donmesin
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));

  if (keepAlpha) {
    // WEBP desteklenmiyorsa tarayici PNG'ye duser; ikisi de seffafligi korur
    const webp = await toBlob("image/webp", 0.9);
    if (webp && webp.type === "image/webp") return webp;
    const png = await toBlob("image/png");
    if (png) return png;
  }
  const jpeg = await toBlob("image/jpeg", 0.85);
  if (!jpeg) throw new Error("Görsel işlenemedi.");
  return jpeg;
}
