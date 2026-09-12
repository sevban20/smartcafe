import type { SelectedOption } from "@/types/menu";

/** Tek adet fiyati = baz fiyat + secilen opsiyonlarin ek ucretleri */
export function calcUnitPrice(basePrice: number, selected: SelectedOption[]) {
  return selected.reduce((sum, o) => sum + (o.extraPrice ?? 0), basePrice);
}

/**
 * Ayni urun + ayni secimler kombinasyonu icin kararli bir anahtar uretir.
 * Sepette ayni satirlarin gruplanmasini saglar.
 */
export function buildLineId(productId: string, selected: SelectedOption[]) {
  const key = selected
    .map((o) => `${o.optionId}:${o.choiceId}`)
    .sort()
    .join("|");
  return `${productId}__${key}`;
}
