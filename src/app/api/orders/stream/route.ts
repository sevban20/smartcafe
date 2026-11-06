import { getCurrentUser } from "@/lib/guards";
import { orderBus, type OrderCreatedEvent } from "@/lib/order-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Yeni siparisleri aninda ileten olay akisi (Server-Sent Events).
 * Baglanti koparsa tarayici kendisi yeniden baglanir; ayrica ekranlar 5 sn'de
 * bir yoklamaya devam eder, yani akis calismasa bile bildirim gecikmeli de olsa gelir.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Yetkisiz", { status: 401 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      write(`retry: 3000\n\n`);
      write(`event: hello\ndata: ${Date.now()}\n\n`);

      const onCreated = (e: OrderCreatedEvent) => write(`event: order\ndata: ${JSON.stringify(e)}\n\n`);
      orderBus.on("created", onCreated);

      // Cloudflare/nginx bos baglantiyi ~100 sn'de keser; arada bir yorum satiri gonder
      const ping = setInterval(() => write(`: ping\n\n`), 20_000);

      cleanup = () => {
        clearInterval(ping);
        orderBus.off("created", onCreated);
        try {
          controller.close();
        } catch {
          /* zaten kapali */
        }
        cleanup = () => {};
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx'in akisi tamponlamasini engeller
      "X-Accel-Buffering": "no",
      // Next'in gzip sikistirmasi akisi biriktirmesin
      "Content-Encoding": "none",
    },
  });
}
