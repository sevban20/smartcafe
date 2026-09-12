import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@smartcafe.local";

export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Kayitli tum personel cihazlarina bildirim gonderir.
 * VAPID anahtarlari tanimli degilse sessizce atlanir; siparis akisi asla bozulmaz.
 * Gecersiz (404/410) abonelikler temizlenir.
 */
export async function sendPushToStaff(payload: PushPayload) {
  if (!pushEnabled) return { sent: 0, skipped: true };

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return { sent: 0, skipped: false };

  const body = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) stale.push(sub.endpoint);
        else console.error("Push gönderilemedi:", statusCode ?? error);
      }
    })
  );

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  }

  return { sent, skipped: false };
}
