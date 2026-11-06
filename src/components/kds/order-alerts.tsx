"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, Play, Smartphone, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SOUNDS,
  flashTitle,
  initAudio,
  isAudioReady,
  onAudioReadyChange,
  playAlert,
  stopFlashTitle,
  unlockAudio,
  vibrate,
  type SoundId,
} from "@/lib/notify";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ================================================================== */
/* Ayarlar (cihaza ozel: her tablet/telefon kendi sesini secer)        */
/* ================================================================== */

export type AlertSettings = {
  enabled: boolean;
  sound: SoundId;
  /** 0-100 */
  volume: number;
  /** Her uyarida kac kez calsin (1-3) */
  times: number;
  /** Bekleyen yeni siparis varken kac saniyede bir hatirlatsin (0 = kapali) */
  repeatSec: number;
  /** Ekran kararmasin (tablet/kasa) */
  wakeLock: boolean;
};

const KEY = "smartcafe-alert-settings";
const LEGACY_KEY = "smartcafe-sound";

const DEFAULTS: AlertSettings = {
  enabled: false,
  sound: "kasa",
  volume: 90,
  times: 2,
  repeatSec: 30,
  wakeLock: false,
};

let current: AlertSettings = DEFAULTS;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AlertSettings>;
      current = { ...DEFAULTS, ...parsed };
      if (!SOUNDS.some((s) => s.id === current.sound)) current.sound = DEFAULTS.sound;
    } else if (localStorage.getItem(LEGACY_KEY) === "1") {
      // Eski "ses acik" tercihi korunur
      current = { ...DEFAULTS, enabled: true };
    }
  } catch {
    /* depolama kapali olabilir */
  }
}

export function updateAlertSettings(patch: Partial<AlertSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* yoksay */
  }
  subs.forEach((fn) => fn());
}

export function useAlertSettings(): AlertSettings {
  return React.useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    () => {
      load();
      return current;
    },
    () => DEFAULTS
  );
}

function useAudioReady() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    initAudio();
    setReady(isAudioReady());
    return onAudioReadyChange(setReady);
  }, []);
  return ready;
}

/* ================================================================== */
/* Ekrani acik tutma                                                   */
/* ================================================================== */

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };

function wakeLockSupported() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function useWakeLock(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || !wakeLockSupported()) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinelLike> } })
          .wakeLock;
        sentinel = await wl.request("screen");
        if (cancelled) await sentinel.release();
      } catch {
        /* pil tasarrufu modunda reddedilebilir */
      }
    };
    void request();
    // Sekme arka plana gidince kilit duser; geri gelince yeniden iste
    const onVis = () => {
      if (!document.hidden && (!sentinel || sentinel.released)) void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}

/* ================================================================== */
/* Yeni siparis takibi                                                 */
/* ================================================================== */

type PendingOrder = { id: string; orderNo: number; tableNo: string; source: string; createdAt: string };

/**
 * Yeni siparisleri izler ve uyarir. KDS'de hangi sekme acik olursa olsun,
 * yonetim panelinin hangi sayfasinda olunursa olsun calisir.
 *
 *  - Anlik: sunucu olay akisi (SSE) yeni siparisi hemen bildirir.
 *  - Yedek: bekleyen siparisler 5 sn'de bir, sekme arka plandayken de yoklanir.
 *    (Eskiden liste 10 sn'de bir ve yalnizca sekme on plandayken yenileniyordu;
 *    "bazen gec geliyor" sikayetinin nedeni buydu.)
 *  - Hatirlatma: siparis hazirlanmaya alinana kadar secilen aralikla tekrar calar.
 */
export function useOrderAlerts({ onNew }: { onNew?: () => void } = {}) {
  const settings = useAlertSettings();
  const queryClient = useQueryClient();
  useWakeLock(settings.wakeLock);

  const { data, refetch } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders/pending", { cache: "no-store" });
      if (!res.ok) throw new Error("Bekleyen siparişler alınamadı");
      return (await res.json()) as { orders: PendingOrder[] };
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // Anlik bildirim akisi
  React.useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/orders/stream");
    const onOrder = () => {
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    };
    es.addEventListener("order", onOrder);
    // Yeniden baglaninca arada kacan olabilir: hemen bir kez yokla
    es.addEventListener("hello", () => void refetch());
    return () => {
      es.removeEventListener("order", onOrder);
      es.close();
    };
  }, [refetch, queryClient]);

  const seen = React.useRef<Set<string> | null>(null);
  const [unacked, setUnacked] = React.useState<string[]>([]);
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const onNewRef = React.useRef(onNew);
  onNewRef.current = onNew;

  const ring = React.useCallback(async () => {
    const s = settingsRef.current;
    if (!s.enabled) return;
    await playAlert({ sound: s.sound, volume: s.volume, times: s.times });
  }, []);

  React.useEffect(() => {
    if (!data) return;
    const pending = data.orders;
    const ids = new Set(pending.map((o) => o.id));

    // Hazirlanmaya alinan / iptal edilen siparisler artik "yeni" sayilmaz
    setUnacked((prev) => {
      const next = prev.filter((id) => ids.has(id));
      return next.length === prev.length ? prev : next;
    });

    // Ilk yuklemede uyari verme, mevcut durumu kaydet
    if (seen.current === null) {
      seen.current = ids;
      return;
    }

    const fresh = pending.filter((o) => !seen.current!.has(o.id));
    pending.forEach((o) => seen.current!.add(o.id));
    if (seen.current.size > 1000) seen.current = ids;
    if (fresh.length === 0) return;

    setUnacked((prev) => [...prev, ...fresh.map((o) => o.id).filter((id) => !prev.includes(id))]);
    void ring();
    vibrate();
    flashTitle(`(${fresh.length}) Yeni sipariş!`);
    toast.info(
      fresh.length === 1
        ? `Yeni sipariş: Masa ${fresh[0].tableNo}${fresh[0].source === "PERSONEL" ? " (garson)" : ""}`
        : `${fresh.length} yeni sipariş geldi`,
      { duration: 8000 }
    );
    onNewRef.current?.();
  }, [data, ring]);

  // Hatirlatma: bekleyen yeni siparis varken araliklarla tekrar cal
  React.useEffect(() => {
    if (!settings.enabled || settings.repeatSec <= 0 || unacked.length === 0) return;
    const t = setInterval(() => void ring(), settings.repeatSec * 1000);
    return () => clearInterval(t);
  }, [settings.enabled, settings.repeatSec, unacked.length, ring]);

  const acknowledge = React.useCallback(() => {
    setUnacked([]);
    stopFlashTitle();
  }, []);

  return { newCount: unacked.length, acknowledge };
}

/* ================================================================== */
/* Ust bar dugmesi + ayar penceresi                                    */
/* ================================================================== */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function usePush() {
  const [state, setState] = React.useState<"loading" | "unsupported" | "off" | "on">("loading");
  const [busy, setBusy] = React.useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  React.useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) return setState("unsupported");
      try {
        const reg = await navigator.serviceWorker.ready;
        setState((await reg.pushManager.getSubscription()) ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, [publicKey]);

  const subscribe = async () => {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        toast.error("Bildirim izni verilmedi.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Abonelik kaydedilemedi.");
      }
      setState("on");
      toast.success("Bildirimler açıldı. Uygulama kapalıyken de haber vereceğiz.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bildirimler açılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Bildirimler kapatıldı.");
    } catch {
      toast.error("Bildirimler kapatılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return { state, busy, subscribe, unsubscribe };
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Ust bardaki ses dugmesi. Dokununca bildirim ayarlari acilir.
 * Ses acik ama tarayici henuz izin vermediyse uzerinde kirmizi nokta yanar.
 */
export function NotificationControls() {
  const settings = useAlertSettings();
  const ready = useAudioReady();
  const [open, setOpen] = React.useState(false);
  const blocked = settings.enabled && !ready;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="relative"
        onClick={() => {
          // Dokunus ayni zamanda ses kanalini acar
          void unlockAudio();
          setOpen(true);
        }}
        aria-label="Bildirim sesi ayarları"
        title={settings.enabled ? "Bildirim sesi açık" : "Bildirim sesi kapalı"}
      >
        {settings.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        {blocked && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />}
      </Button>
      <AlertSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Ses acik ama tarayici kanali kapattiysa (sayfa yenilendi, ekran kilitlendi) gorunur. */
export function AudioUnlockBanner() {
  const settings = useAlertSettings();
  const ready = useAudioReady();
  if (!settings.enabled || ready) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (await unlockAudio()) toast.success("Bildirim sesi açık");
        else toast.error("Tarayıcı ses çalmaya izin vermedi.");
      }}
      className="flex w-full items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
    >
      <VolumeX className="h-4 w-4" />
      Bildirim sesi için ekrana bir kez dokunun
    </button>
  );
}

export function AlertSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useAlertSettings();
  const push = usePush();
  const [previewing, setPreviewing] = React.useState<SoundId | null>(null);

  const preview = async (sound: SoundId = s.sound) => {
    setPreviewing(sound);
    await unlockAudio();
    const ok = await playAlert({ sound, volume: s.volume, times: 1 });
    if (!ok) toast.error("Ses çalınamadı. Telefonun ses düzeyini ve sessiz modunu kontrol edin.");
    setTimeout(() => setPreviewing(null), 600);
  };

  const toggleEnabled = async (v: boolean) => {
    if (v) {
      const ok = await unlockAudio();
      if (!ok) {
        toast.error("Tarayıcı ses çalmaya izin vermedi.");
        return;
      }
      updateAlertSettings({ enabled: true });
      void playAlert({ sound: s.sound, volume: s.volume, times: 1 });
    } else {
      updateAlertSettings({ enabled: false });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sipariş bildirimi</DialogTitle>
          <DialogDescription>Bu ayarlar yalnızca bu cihaz için geçerli.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Sesli bildirim</span>
              <span className="block text-xs text-muted-foreground">Yeni sipariş gelince bu cihaz çalar</span>
            </span>
            <Switch checked={s.enabled} onCheckedChange={toggleEnabled} />
          </label>

          <div className={cn("space-y-5", !s.enabled && "pointer-events-none opacity-50")}>
            <div className="space-y-2">
              <Label>Ses</Label>
              <div className="space-y-1.5">
                {SOUNDS.map((snd) => (
                  <div
                    key={snd.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-2.5 pl-3",
                      s.sound === snd.id && "border-primary bg-accent/40"
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => {
                        updateAlertSettings({ sound: snd.id });
                        void preview(snd.id);
                      }}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          s.sound === snd.id ? "border-primary" : "border-muted-foreground/40"
                        )}
                      >
                        {s.sound === snd.id && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{snd.label}</span>
                        <span className="block text-xs text-muted-foreground">{snd.hint}</span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${snd.label} sesini dinle`}
                      onClick={() => void preview(snd.id)}
                    >
                      {previewing === snd.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ses-seviye">Ses seviyesi</Label>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">%{s.volume}</span>
              </div>
              <input
                id="ses-seviye"
                type="range"
                min={20}
                max={100}
                step={5}
                value={s.volume}
                onChange={(e) => updateAlertSettings({ volume: Number(e.target.value) })}
                onPointerUp={() => void preview()}
                onKeyUp={() => void preview()}
                className="w-full accent-[hsl(var(--primary))]"
              />
              <p className="text-[11px] text-muted-foreground">
                %100 sesi dolgunlaştırıp en yüksek seviyeye çıkarır. Cihazın kendi ses düzeyi de açık olmalı.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Her siparişte kaç kez çalsın</Label>
              <Segmented
                value={s.times}
                onChange={(v) => updateAlertSettings({ times: v })}
                options={[
                  { value: 1, label: "1 kez" },
                  { value: 2, label: "2 kez" },
                  { value: 3, label: "3 kez" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label>Hatırlatma</Label>
              <Segmented
                value={s.repeatSec}
                onChange={(v) => updateAlertSettings({ repeatSec: v })}
                options={[
                  { value: 0, label: "Kapalı" },
                  { value: 15, label: "15 sn" },
                  { value: 30, label: "30 sn" },
                  { value: 60, label: "1 dk" },
                ]}
              />
              <p className="text-[11px] text-muted-foreground">
                Sipariş &ldquo;Hazırlanıyor&rdquo;a alınana ya da &ldquo;yeni&rdquo; rozetine dokunulana kadar tekrar çalar.
              </p>
            </div>
          </div>

          {wakeLockSupported() && (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Smartphone className="h-4 w-4" />
                  Ekranı açık tut
                </span>
                <span className="block text-xs text-muted-foreground">
                  Tablet/kasa için önerilir: ekran kararınca tarayıcı sesi kesebilir.
                </span>
              </span>
              <Switch checked={s.wakeLock} onCheckedChange={(v) => updateAlertSettings({ wakeLock: v })} />
            </label>
          )}

          {push.state !== "unsupported" && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {push.state === "on" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    Uygulama kapalıyken bildirim
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Ekran kilitliyken telefonun kendi bildirim sesiyle haber verir (yalnızca QR siparişleri).
                  </span>
                </span>
                <Button
                  variant={push.state === "on" ? "outline" : "default"}
                  size="sm"
                  disabled={push.busy || push.state === "loading"}
                  onClick={push.state === "on" ? push.unsubscribe : push.subscribe}
                >
                  {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : push.state === "on" ? "Kapat" : "Aç"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
