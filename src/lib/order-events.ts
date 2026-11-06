import { EventEmitter } from "events";

/**
 * Sunucu ici olay yolu: yeni siparis gelince acik sipariş ekranlarina (SSE)
 * aninda haber verir. Uygulama tek surec olarak calistigi icin bellek ici
 * yeterli. Next her route'u ayri paketleyebildigi icin ornek globalThis'te tutulur.
 */
type Bus = EventEmitter;
const g = globalThis as unknown as { __smartcafeOrderBus?: Bus };

export const orderBus: Bus =
  g.__smartcafeOrderBus ??
  (g.__smartcafeOrderBus = (() => {
    const e = new EventEmitter();
    e.setMaxListeners(500);
    return e;
  })());

export type OrderCreatedEvent = { id: string; orderNo: number; tableNo: string; source: string };

export function emitOrderCreated(event: OrderCreatedEvent) {
  try {
    orderBus.emit("created", event);
  } catch (e) {
    console.error("Sipariş olayı yayınlanamadı:", e);
  }
}
