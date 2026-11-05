import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { MIME_BY_EXT, resolveUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Yuklenen dosyalari sunar. Dosya adlari rastgele ve degismez oldugu icin
 * tarayici/Cloudflare bir yil onbellekte tutabilir.
 *
 * Range destegi sart: iPhone Safari videoyu parca parca (Range) istemeden oynatmaz.
 */
export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  const file = resolveUploadPath(params.path ?? []);
  if (!file) return new Response("Bulunamadı", { status: 404 });

  let size: number;
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error("dosya degil");
    size = stat.size;
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }

  const ext = path.extname(file).slice(1).toLowerCase();
  const type = MIME_BY_EXT[ext];
  if (!type) return new Response("Bulunamadı", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
