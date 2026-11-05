import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Yuklenen gorsel/videolar veritabaninda degil diskte durur:
 *  - Docker'da /app/uploads (docker-compose'daki "uploads" volume'u), yeniden
 *    derlemede silinmez.
 *  - Yerelde proje kokundeki uploads/ klasoru.
 * Dosyalar /uploads/... adresinden sunulur (src/app/uploads/[...path]/route.ts).
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
export const UPLOAD_URL_PREFIX = "/uploads/";

export type UploadKind = "image" | "video";

export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  image: 8 * 1024 * 1024,
  video: 60 * 1024 * 1024,
};

/** Uzanti -> icerik tipi. SVG bilerek yok (icinde script calistirilabilir). */
export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/**
 * Dosya turunu iceriginden (ilk baytlar) belirler; tarayicinin bildirdigi
 * tipe/uzantiya guvenmez.
 */
export function sniffExtension(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    return brand === "qt  " ? "mov" : "mp4";
  }
  return null;
}

export function kindOfExtension(ext: string): UploadKind {
  return ["mp4", "webm", "mov"].includes(ext) ? "video" : "image";
}

/** Dosyayi kaydeder, herkese acik adresini dondurur. Ornek: /uploads/2026-11/uuid.webp */
export async function saveUpload(buf: Buffer, ext: string): Promise<string> {
  const now = new Date();
  const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return `${UPLOAD_URL_PREFIX}${folder}/${name}`;
}

/** /uploads/... adresini diskteki guvenli yola cevirir; disari tasan yollari reddeder. */
export function resolveUploadPath(segments: string[]): string | null {
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\0") || s.includes("\\"))) return null;
  const full = path.resolve(UPLOAD_DIR, ...segments);
  const root = path.resolve(UPLOAD_DIR) + path.sep;
  return full.startsWith(root) ? full : null;
}

/** Eski yontem: veritabanina gomulu data URL'i dosyaya cevirir. Gecersizse null. */
export async function dataUrlToUpload(dataUrl: string): Promise<string | null> {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  const ext = sniffExtension(buf);
  if (!ext || kindOfExtension(ext) !== "image") return null;
  return saveUpload(buf, ext);
}

/**
 * Gorsel/video alanlarinda kabul edilen degerler: bos, kendi yuklememiz,
 * dis https adresi ya da (eski kayitlar icin) gomulu gorsel.
 */
export function isAcceptableMediaRef(v: string): boolean {
  return (
    v === "" ||
    v.startsWith(UPLOAD_URL_PREFIX) ||
    /^https?:\/\//.test(v) ||
    /^data:image\/(jpeg|png|webp);base64,/.test(v)
  );
}
