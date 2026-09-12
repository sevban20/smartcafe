import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import { pushEnabled } from "@/lib/push";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Cihazi bildirim listesine ekler (yalnizca giris yapmis personel). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!pushEnabled) {
    return NextResponse.json(
      { error: "Sunucuda VAPID anahtarları tanımlı değil. .env dosyasına ekleyin." },
      { status: 503 }
    );
  }

  const parsed = subscribeSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz abonelik" }, { status: 400 });
  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: user.id,
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Cihazi bildirim listesinden cikarir. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "endpoint gerekli" }, { status: 400 });

  // Yalnizca kendi abonelini silebilirsin, baskasinin cihazini degil.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
