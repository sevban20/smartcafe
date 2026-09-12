import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { APP_TZ } from "@/lib/tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: APP_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** "3 dk once" gibi kisa gecen sure metni */
export function timeAgo(date: Date | string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "az once";
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min} dk once`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa once`;
  return `${Math.floor(hour / 24)} gun once`;
}
