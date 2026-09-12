/**
 * Tarih sinirlarini SUNUCUNUN saat diliminden bagimsiz hesaplar.
 *
 * Neden gerekli: Vercel gibi barindirma servisleri UTC'de calisir. "Bugunun cirosu"
 * sunucunun gece yarisina gore hesaplanirsa Turkiye'de gun saat 03:00'te degisir ve
 * sabahin erken satislari bir onceki gune yazilir. Buradaki fonksiyonlar gunun/ayin
 * basini her zaman kafenin yerel saatine gore bulur.
 */

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Europe/Istanbul";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Bir ani, hedef saat diliminde gorunen "duvar saati" parcalarina cevirir. */
function wallClock(date: Date): Wall {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // 24:00 bazi ortamlarda gece yarisi icin dondurulebiliyor
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Verilen anda hedef saat diliminin UTC'ye gore farki (ms). */
function offsetMs(date: Date): number {
  const w = wallClock(date);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Yerel duvar saatinden gercek bir ana (UTC instant) cevirir. */
function fromWall(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  // Ilk tahmin, sonra o andaki gercek farkla duzelt (DST'li bolgeler icin de dogru)
  const guess = new Date(naive - offsetMs(new Date(naive)));
  return new Date(naive - offsetMs(guess));
}

/** Kafenin yerel saatine gore gunun basi */
export function startOfDay(date = new Date()): Date {
  const w = wallClock(date);
  return fromWall(w.year, w.month, w.day);
}

/** Kafenin yerel saatine gore ayin basi */
export function startOfMonth(date = new Date()): Date {
  const w = wallClock(date);
  return fromWall(w.year, w.month, 1);
}

/** Kafenin yerel saatine gore yilin basi */
export function startOfYear(date = new Date()): Date {
  const w = wallClock(date);
  return fromWall(w.year, 1, 1);
}

/** N ay geriye/ileriye giderek o ayin basini verir */
export function addMonths(date: Date, months: number): Date {
  const w = wallClock(date);
  const total = (w.year * 12 + (w.month - 1)) + months;
  return fromWall(Math.floor(total / 12), (total % 12) + 1, 1);
}

/** Gun ekler; sonuc yine yerel gun basidir */
export function addDays(date: Date, days: number): Date {
  const w = wallClock(date);
  return fromWall(w.year, w.month, w.day + days);
}

/** Grafik etiketleri icin YYYY-MM-DD (yerel gune gore) */
export function localDayKey(date: Date): string {
  const w = wallClock(date);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}
