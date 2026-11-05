import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/guards";
import { UPLOAD_LIMITS, kindOfExtension, saveUpload, sniffExtension, type UploadKind } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Yonetici panelinden gorsel/video yukleme. multipart/form-data:
 *   file: dosya, kind: "image" | "video"
 * Donus: { url: "/uploads/..." }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yalnızca yönetici dosya yükleyebilir." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 400 });
  }

  const file = form.get("file");
  const wanted = (form.get("kind") as UploadKind | null) ?? "image";
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });

  const limit = UPLOAD_LIMITS[wanted] ?? UPLOAD_LIMITS.image;
  if (file.size > limit) {
    return NextResponse.json(
      { error: `Dosya çok büyük (en fazla ${Math.round(limit / 1024 / 1024)} MB).` },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffExtension(buf);
  if (!ext) {
    return NextResponse.json(
      { error: "Desteklenmeyen dosya. Görsel için JPG/PNG/WEBP, video için MP4/WEBM/MOV yükleyin." },
      { status: 415 }
    );
  }
  if (kindOfExtension(ext) !== wanted) {
    return NextResponse.json(
      { error: wanted === "video" ? "Lütfen bir video dosyası seçin." : "Lütfen bir görsel dosyası seçin." },
      { status: 415 }
    );
  }

  const url = await saveUpload(buf, ext);
  return NextResponse.json({ url });
}
