"use client";

/**
 * Yeni siparis uyarilari: ses, sekme basligi yanip sonmesi ve titresim.
 *
 * Sesler WebAudio ile uretilip WAV'a cevrilir ve bir <audio> ogesiyle calinir:
 *  - iPhone'da WebAudio sessiz moda (yan dugme) takilir, <audio> takilmaz.
 *  - Ses seviyesi dalga formuna "pisirilir": iPhone audio.volume'u yok sayar.
 *  - Tarayicilar sesi ancak bir dokunustan sonra acar. Ekran kilitlenince ses
 *    kanali tekrar kapanabilir; sayfadaki her dokunus kanali yeniden acar.
 */

export type SoundId = "zil" | "kasa" | "kapi" | "marimba" | "alarm";

export const SOUNDS: { id: SoundId; label: string; hint: string }[] = [
  { id: "zil", label: "Klasik zil", hint: "Kısa, iki notalı" },
  { id: "kasa", label: "Kasa", hint: "Parlak, üç vuruşlu" },
  { id: "kapi", label: "Kapı zili", hint: "Ding-dong" },
  { id: "marimba", label: "Marimba", hint: "Yumuşak, yükselen" },
  { id: "alarm", label: "Alarm", hint: "Yüksek, gürültülü mutfak için" },
];

const SAMPLE_RATE = 44100;

/* ------------------------------------------------------------------ */
/* Ses sentezi                                                         */
/* ------------------------------------------------------------------ */

type ToneOpts = {
  freq: number;
  start: number;
  dur: number;
  peak?: number;
  type?: OscillatorType;
  attack?: number;
};

function tone(ctx: BaseAudioContext, out: AudioNode, t0: number, o: ToneOpts) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = t0 + o.start;
  const peak = o.peak ?? 0.5;
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + (o.attack ?? 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + o.dur + 0.05);
}

/** Metal zil: temel frekans + uyumsuz ust tonlar (gercek zil gibi tinlar) */
function bell(ctx: BaseAudioContext, out: AudioNode, t0: number, freq: number, start: number, dur: number, peak = 0.5) {
  const partials: [number, number][] = [
    [1, 1],
    [2.0, 0.45],
    [2.76, 0.3],
    [5.4, 0.12],
  ];
  for (const [mult, amp] of partials) {
    tone(ctx, out, t0, { freq: freq * mult, start, dur: dur / Math.sqrt(mult), peak: peak * amp, attack: 0.004 });
  }
}

/** Her ses: cizer ve toplam suresini (sn) dondurur */
const VOICES: Record<SoundId, (ctx: BaseAudioContext, out: AudioNode, t0: number) => number> = {
  zil: (ctx, out, t0) => {
    tone(ctx, out, t0, { freq: 880, start: 0, dur: 0.25, peak: 0.6, type: "triangle" });
    tone(ctx, out, t0, { freq: 1760, start: 0, dur: 0.18, peak: 0.15 });
    tone(ctx, out, t0, { freq: 1318.5, start: 0.18, dur: 0.5, peak: 0.6, type: "triangle" });
    tone(ctx, out, t0, { freq: 2637, start: 0.18, dur: 0.3, peak: 0.15 });
    return 0.75;
  },
  kasa: (ctx, out, t0) => {
    bell(ctx, out, t0, 1568, 0, 0.6, 0.55);
    bell(ctx, out, t0, 1568, 0.17, 0.6, 0.55);
    bell(ctx, out, t0, 2093, 0.34, 0.9, 0.6);
    return 1.3;
  },
  kapi: (ctx, out, t0) => {
    bell(ctx, out, t0, 659.3, 0, 1.4, 0.7);
    bell(ctx, out, t0, 523.3, 0.55, 1.8, 0.7);
    return 2.3;
  },
  marimba: (ctx, out, t0) => {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      tone(ctx, out, t0, { freq: f, start: i * 0.11, dur: 0.45, peak: 0.55, attack: 0.003 });
      tone(ctx, out, t0, { freq: f * 4, start: i * 0.11, dur: 0.08, peak: 0.12, attack: 0.002 });
    });
    return 0.9;
  },
  alarm: (ctx, out, t0) => {
    // Kare dalga, iki ton arasinda gidip gelir: telefon hoparlorunde en yuksek duyulan
    for (let i = 0; i < 6; i++) {
      tone(ctx, out, t0, { freq: i % 2 ? 988 : 1319, start: i * 0.16, dur: 0.14, peak: 0.35, type: "square", attack: 0.004 });
    }
    return 1.05;
  },
};

/* ------------------------------------------------------------------ */
/* WAV uretimi                                                         */
/* ------------------------------------------------------------------ */

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

const urlCache = new Map<string, string>();

/**
 * Sesi istenen seviyede ve tekrar sayisinda WAV olarak uretir (onbellekli).
 * Seviye %100'de yumusak sinirlama (tanh) ile algilanan ses yukseltilir;
 * telefon hoparlorunde "az geliyor" sikayetinin ana cozumu bu.
 */
async function renderSound(id: SoundId, volume: number, times: number): Promise<string | null> {
  const key = `${id}:${volume}:${times}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const Offline =
    typeof window !== "undefined"
      ? (window.OfflineAudioContext ??
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext)
      : undefined;
  if (!Offline) return null;

  const voice = VOICES[id] ?? VOICES.zil;
  // Sureyi olcmek icin bir kez gecici baglamda ciz
  const probe = new Offline(1, SAMPLE_RATE, SAMPLE_RATE);
  const single = voice(probe, probe.destination, 0);
  const gap = 0.25;
  const total = single * times + gap * (times - 1) + 0.1;

  const ctx = new Offline(1, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);
  for (let i = 0; i < times; i++) voice(ctx, ctx.destination, i * (single + gap));
  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);

  // Normalize + yumusak sinirlama: drive arttikca ses dolgunlasir, tepe asilmaz
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const level = Math.max(0, Math.min(100, volume)) / 100;
  const drive = 1 + level * 2.2;
  const norm = peak > 0 ? 1 / peak : 1;
  const outPeak = Math.tanh(drive);
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = (Math.tanh(data[i] * norm * drive) / outPeak) * 0.98 * level;
  }

  const url = URL.createObjectURL(encodeWav(out));
  urlCache.set(key, url);
  return url;
}

/* ------------------------------------------------------------------ */
/* Ses kanali (kilit acma)                                             */
/* ------------------------------------------------------------------ */

let silentUrl: string | null = null;
/** 0,05 sn sessizlik: kilit acmak icin calinir */
function silentWav() {
  if (!silentUrl) silentUrl = URL.createObjectURL(encodeWav(new Float32Array(Math.round(SAMPLE_RATE * 0.05))));
  return silentUrl;
}

let audioEl: HTMLAudioElement | null = null;
let unlocked = false;
const listeners = new Set<(ready: boolean) => void>();

function setUnlocked(v: boolean) {
  if (unlocked === v) return;
  unlocked = v;
  listeners.forEach((l) => l(v));
}

/** Ses kanalinin acik olup olmadigini dinle (uyari bandi icin) */
export function onAudioReadyChange(fn: (ready: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isAudioReady() {
  return unlocked;
}

function getEl() {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
    audioEl.setAttribute("playsinline", "");
  }
  return audioEl;
}

/** Bir dokunus icinde cagrilmali: ses kanalini acar. */
export async function unlockAudio(): Promise<boolean> {
  const el = getEl();
  if (!el) return false;
  try {
    // iOS 16.4+: WebAudio'nun da sessiz modu yok saymasini iste
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    /* desteklenmiyor */
  }
  try {
    el.src = silentWav();
    await el.play();
    setUnlocked(true);
    return true;
  } catch {
    setUnlocked(false);
    return false;
  }
}

let initialized = false;

/**
 * Sayfadaki her dokunusta ses kanalini yeniden acmaya calisir. Boylece sayfa
 * yenilendiginde ya da ekran kilitlenip acildiginda ilk dokunus sesi geri getirir.
 */
export function initAudio() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const relock = () => {
    if (!unlocked) void unlockAudio();
  };
  for (const ev of ["pointerdown", "keydown", "touchend"]) {
    window.addEventListener(ev, relock, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", () => {
    // Ekran kilitlenince bazi tarayicilar kanali kapatir; geri gelince dene
    if (!document.hidden && audioEl && audioEl.paused) void unlockAudio().catch(() => undefined);
  });
}

/* ------------------------------------------------------------------ */
/* Calma                                                               */
/* ------------------------------------------------------------------ */

export type AlertSound = { sound: SoundId; volume: number; times: number };

/** Siparis uyarisini calar. Ses kanali kapaliysa false doner (uyari bandi gosterilir). */
export async function playAlert({ sound, volume, times }: AlertSound): Promise<boolean> {
  const el = getEl();
  if (!el) return false;
  const url = await renderSound(sound, volume, Math.max(1, Math.min(3, times)));
  if (!url) return false;
  try {
    el.pause();
    el.src = url;
    el.currentTime = 0;
    await el.play();
    setUnlocked(true);
    return true;
  } catch {
    setUnlocked(false);
    return false;
  }
}

export function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.([200, 100, 200, 100, 200]);
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
