import type { CancelReason, OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Bekliyor",
  PREPARING: "Hazırlanıyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PREPARING: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
};

export const EXPENSE_CATEGORIES = [
  "Hammadde",
  "Personel",
  "Kira",
  "Fatura",
  "Ekipman",
  "Pazarlama",
  "Diğer",
] as const;

export const PAYMENT_METHODS = ["Nakit", "Kart", "Diğer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CANCEL_REASONS: { value: CancelReason; label: string; hint: string; isWaste: boolean }[] = [
  {
    value: "MUSTERI_VAZGECTI",
    label: "Müşteri vazgeçti",
    hint: "Ürün hazırlanmadı, maliyet oluşmadı",
    isWaste: false,
  },
  {
    value: "YANLIS_GIRILDI",
    label: "Yanlış girildi",
    hint: "Personel hatası, sipariş baştan girilecek",
    isWaste: false,
  },
  {
    value: "FIRE",
    label: "Fire / zayi",
    hint: "Hazırlandı ama döküldü, yanlış yapıldı — maliyet oluştu",
    isWaste: true,
  },
  {
    value: "STOK_YOK",
    label: "Ürün kalmadı",
    hint: "Malzeme bitti, hazırlanamadı",
    isWaste: false,
  },
  { value: "DIGER", label: "Diğer", hint: "Açıklama yazmanız önerilir", isWaste: false },
];

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  MUSTERI_VAZGECTI: "Müşteri vazgeçti",
  YANLIS_GIRILDI: "Yanlış girildi",
  FIRE: "Fire / zayi",
  STOK_YOK: "Ürün kalmadı",
  DIGER: "Diğer",
};
