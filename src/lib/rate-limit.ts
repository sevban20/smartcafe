/**
 * Basit, bagimliliksiz hiz sinirlayici.
 *
 * Musteri menusu QR ile herkese acik ve giris istemez — bu tasarim geregi dogru,
 * ama linki eline gecirenin disaridan yuzlerce sahte siparis basmasini engellemek
 * gerekiyor. Burasi bellekte tutar; sunucu yeniden baslayinca veya birden fazla
 * ornek calisiyorsa (Vercel) sayac sifirlanabilir. Yine de kotu niyetli tekrarlari
 * ve en sik gorulen sorunu — musterinin "Gonder"e iki kez basmasini — durdurur.
 *
 * Daha sert bir koruma gerekirse Upstash Redis gibi paylasimli bir sayaca gecilir.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();
const fingerprints = new Map<string, number>();

/** Bellegin sinirsiz buyumesini onler */
function sweep(now: number) {
  if (buckets.size > 5000) {
    buckets.forEach((hit, key) => {
      if (hit.resetAt <= now) buckets.delete(key);
    });
  }
  if (fingerprints.size > 5000) {
    fingerprints.forEach((at, key) => {
      if (at <= now) fingerprints.delete(key);
    });
  }
}

/**
 * `key` icin `windowMs` suresinde en fazla `limit` istek.
 * Sinir asilirsa { ok: false, retryAfter } doner.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1 };
  }
  if (hit.count >= limit) {
    return { ok: false as const, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  hit.count++;
  return { ok: true as const, remaining: limit - hit.count };
}

/**
 * Ayni istegin kisa sure icinde tekrar gelmesini engeller
 * (cift tiklama, ag tekrari, "Gonder"e iki kez basma).
 * Ilk cagrida true, pencere icindeki tekrarlarda false doner.
 */
export function claimOnce(fingerprint: string, windowMs = 45_000) {
  const now = Date.now();
  sweep(now);

  const seenUntil = fingerprints.get(fingerprint);
  if (seenUntil && seenUntil > now) return false;

  fingerprints.set(fingerprint, now + windowMs);
  return true;
}

/**
 * Ters vekil (nginx) ve Cloudflare arkasindan gercek istemci IP'sini cikarir.
 *
 * ONEMLI: Bu basliklara ancak vekil sunucu onlari KENDISI yaziyorsa guvenilebilir.
 * nginx yapilandirmasinda proxy_set_header X-Real-IP / X-Forwarded-For satirlari
 * olmali; aksi halde istemci bu basligi uydurup hiz sinirini atlatabilir.
 */
export function clientIp(req: Request) {
  // Cloudflare kullaniliyorsa en guvenilir kaynak budur
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return "bilinmeyen";
}
