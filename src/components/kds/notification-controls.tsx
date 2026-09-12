"use client";

import * as React from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playChime, unlockAudio } from "@/lib/notify";
import { toast } from "sonner";

const SOUND_KEY = "smartcafe-sound";

/** base64url VAPID anahtarini Uint8Array'e cevirir */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function useSoundEnabled() {
  const [soundOn, setSoundOn] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) === "1") setSoundOn(true);
    } catch {
      /* depolama kapali olabilir */
    }
  }, []);

  const toggle = React.useCallback(async () => {
    if (soundOn) {
      setSoundOn(false);
      try {
        localStorage.setItem(SOUND_KEY, "0");
      } catch {
        /* yoksay */
      }
      return;
    }
    const ok = await unlockAudio();
    if (!ok) {
      toast.error("Tarayıcı ses çalmaya izin vermedi.");
      return;
    }
    playChime();
    setSoundOn(true);
    try {
      localStorage.setItem(SOUND_KEY, "1");
    } catch {
      /* yoksay */
    }
  }, [soundOn]);

  return { soundOn, toggle };
}

export function NotificationControls({
  soundOn,
  onToggleSound,
}: {
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  const [pushState, setPushState] = React.useState<"loading" | "unsupported" | "off" | "on">("loading");
  const [busy, setBusy] = React.useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  React.useEffect(() => {
    const check = async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) {
        setPushState("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : "off");
      } catch {
        setPushState("unsupported");
      }
    };
    check();
  }, [publicKey]);

  const subscribe = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
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
      setPushState("on");
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
      setPushState("off");
      toast.success("Bildirimler kapatıldı.");
    } catch {
      toast.error("Bildirimler kapatılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleSound}
        aria-label={soundOn ? "Sesi kapat" : "Sesi aç"}
        title={soundOn ? "Ses açık" : "Ses kapalı"}
      >
        {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
      </Button>

      {pushState !== "unsupported" && (
        <Button
          variant="outline"
          size="icon"
          disabled={busy || pushState === "loading"}
          onClick={pushState === "on" ? unsubscribe : subscribe}
          aria-label={pushState === "on" ? "Bildirimleri kapat" : "Bildirimleri aç"}
          title={pushState === "on" ? "Bildirimler açık" : "Bildirimleri aç"}
        >
          {pushState === "on" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        </Button>
      )}
    </div>
  );
}
