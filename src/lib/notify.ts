"use client";

/**
 * Yeni siparis uyarilari: ses (WebAudio ile uretilir, dosya gerekmez),
 * sekme basligi yanip sonmesi ve titresim.
 */

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/**
 * Mobil tarayicilar sesi ancak bir kullanici etkilesiminden sonra calmaya izin verir.
 * Bu fonksiyon bir tiklama icinde cagrilarak ses kanalini acar.
 */
export async function unlockAudio() {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx.state === "running";
}

/** Iki notalik kisa bir zil sesi */
export function playChime() {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 880, start: 0, dur: 0.18 },
    { freq: 1318.5, start: 0.16, dur: 0.32 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(0.25, now + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.02);
  }
}

export function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.([120, 60, 120]);
  }
}

let flashTimer: ReturnType<typeof setInterval> | null = null;
let originalTitle = "";

/** Sekme basligini yanip sondurur; sayfaya donulunce durur. */
export function flashTitle(message: string) {
  if (typeof document === "undefined") return;
  if (!flashTimer) originalTitle = document.title;

  stopFlashTitle(false);
  let on = true;
  flashTimer = setInterval(() => {
    document.title = on ? message : originalTitle;
    on = !on;
  }, 900);

  const stop = () => stopFlashTitle(true);
  window.addEventListener("focus", stop, { once: true });
  document.addEventListener("visibilitychange", function handler() {
    if (!document.hidden) {
      stopFlashTitle(true);
      document.removeEventListener("visibilitychange", handler);
    }
  });
}

export function stopFlashTitle(restore = true) {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  if (restore && originalTitle && typeof document !== "undefined") {
    document.title = originalTitle;
  }
}
