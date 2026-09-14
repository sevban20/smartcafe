# SmartCafe OS

Kafe yönetim, QR dijital menü, sipariş takibi (KDS) ve gelir–gider sistemi.
Next.js 14 (App Router) · Prisma · PostgreSQL · NextAuth · Tailwind + Shadcn UI · PWA.

---

## Kurulum (adım adım)

### 1. Paketleri yükle

```bash
npm install
```

### 2. Veritabanını hazırla

Ücretsiz bir PostgreSQL alabileceğin iki yer:

**Supabase** (önerilen)
1. https://supabase.com → yeni proje oluştur (bölge: Frankfurt/Central EU en yakını).
2. Project Settings → Database → **Connection string → URI**.
3. `Transaction pooler` adresini `DATABASE_URL`, `Direct connection` adresini `DIRECT_URL` olarak kullan.

**Neon**
1. https://neon.tech → yeni proje.
2. Dashboard → Connection string → hem `DATABASE_URL` hem `DIRECT_URL` için aynısını kullanabilirsin.

### 3. Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

```bash
cp .env.example .env
```

`NEXTAUTH_SECRET` üretmek için:

```bash
openssl rand -base64 32
```

### 4. Tabloları oluştur ve örnek menüyü yükle

```bash
npm run db:push     # şemayı veritabanına yazar
npm run db:seed     # yönetici + personel hesabı ve örnek menü
```

Seed sonrası giriş bilgileri (`.env` içinden değiştirilebilir):

| Rol | E-posta | Şifre |
|---|---|---|
| Yönetici | `admin@smartcafe.local` | `admin123` |
| Personel | `barista@smartcafe.local` | `barista123` |

> İlk girişten sonra bu şifreleri mutlaka değiştir (veya `.env`'de kendi bilgilerinle seed'i çalıştır).

### 5. Çalıştır

```bash
npm run dev
```

http://localhost:3000

---

## Ekranlar

| Adres | Kim kullanır | Ne yapar |
|---|---|---|
| `/menu/[masaNo]` | Müşteri | QR ile açılan menü, seçenekli ürün ekleme, sepet, sipariş |
| `/menu` | Müşteri | Masa numarası girip menüye geçiş |
| `/kds` | Personel | Aktif siparişler, "Hazırla / Teslim et / İptal" |
| `/siparis` | Personel | Garsonun masa adına sipariş girdiği ekran |
| `/yonetim` | Yönetici | Günlük özet, grafik, en çok satanlar |
| `/yonetim/menu` | Yönetici | Kategori + ürün + seçenek grubu yönetimi |
| `/yonetim/siparisler` | Yönetici | Sipariş geçmişi ve detayları |
| `/yonetim/finans` | Yönetici | Gelir/gider hareketleri, kâr marjı, gider kalemi dağılımı |
| `/yonetim/finans/tedarikciler` | Yönetici | Toptancı kartları ve cari hesap bakiyeleri |
| `/yonetim/finans/kalemler` | Yönetici | Kendi gider kalemlerini tanımlama |
| `/hesaplar` | Personel | Açık masa hesapları (tam ekran, KDS'e dönüş oklu) |
| `/yonetim/hesaplar` | Yönetici | Aynı ekran, yönetim panelinin içinde |
| `/yonetim/iptaller` | Yönetici | İptal raporu: kim, neyi, neden iptal etti; fire takibi |
| `/yonetim/personel` | Yönetici | Garson/yönetici hesapları ekleme, rol, şifre, pasife alma |
| `/yonetim/qr` | Yönetici | Masa QR kodlarını üret, indir, yazdır |

---

## Nasıl çalışıyor (önemli detaylar)

**Fiyat hesabı sunucuda yapılır.** `POST /api/orders` isteğinde istemciden gelen
fiyatlar dikkate alınmaz; ürün ve seçenek fiyatları veritabanından tekrar okunup
toplam yeniden hesaplanır. Zorunlu seçenek kontrolü de sunucuda yapılır.

**Sipariş geçmişi bozulmaz.** Müşterinin seçtiği seçenekler `OrderItemOption`
tablosuna *metin olarak* (optionName, choiceName, extraPrice) kopyalanır. Yönetici
ileride "Süt Tercihi" grubunu silse bile eski fişler olduğu gibi kalır. Ürün adı da
`OrderItem.productName` alanında saklanır.

**Gelir otomatik işlenir.** Bir sipariş `COMPLETED` yapıldığında sipariş tutarı
kadar `INCOME` tipinde bir `Transaction` oluşur (`orderId` ile bire bir bağlı, bu
yüzden çift kayıt oluşamaz). Sipariş tamamlanmış durumdan çıkarılırsa bu gelir
kaydı otomatik silinir. Otomatik gelirler finans ekranından elle silinemez.

**Ürün görselleri.** İki yol var: bir bağlantı (https://...) yapıştırabilir ya da
doğrudan dosya yükleyebilirsin. Yüklenen görsel tarayıcıda 800px genişliğe küçültülüp
JPEG'e sıkıştırılır ve `Product.imageUrl` alanına `data:` URL olarak gömülür — yani
ayrı bir dosya deposu (S3, Supabase Storage) kurmana gerek yok. ~350 KB üstü çıkarsa
kalite kademeli düşürülür. Menüde çok sayıda ürün olacaksa ileride gerçek bir
depolama servisine geçmek daha verimli olur.

**Müşteri hesabı.** Menü ekranının üstündeki "Siparişlerim" düğmesi, o masanın
**açık hesabını** — durumlarıyla birlikte (Bekliyor / Hazırlanıyor / Tamamlandı) ve
ödenecek toplam tutarı — gösterir. `GET /api/masa/[masaNo]` giriş gerektirmez ama
yalnızca o masanın **ödenmemiş**, iptal edilmemiş, son 12 saat içindeki kayıtlarını
döndürür. 15 saniyede bir kendini yeniler.

**Hesap kapatma.** `/hesaplar` ekranı (personel ve yönetici) açık masaları tutarlarıyla
listeler. "Hesabı Kapat" → Nakit / Kart / Diğer seçilir; o masanın ödenmemiş tüm
siparişleri `paidAt` ve `paymentMethod` ile damgalanır, **durumları da TAMAMLANDI'ya
çekilir** ve gelir kaydı olmayanlar için gelir yazılır. Bu son kısım önemli: gelir
normalde sipariş "teslim edildi" olunca oluşuyor, dolayısıyla hâlâ hazırlanmakta olan
bir sipariş kapatılırsa tahsil edilen para ciroya hiç girmezdi. Hesabı kapatılmış bir
sipariş artık KDS'ten geri alınamaz (gelir kaydı silinir ama para tahsil edilmiş
kalırdı) — sistem 409 ile reddeder. Bu an itibarıyla müşteri
ekranındaki liste boşalır — masaya oturan bir sonraki müşteri önceki hesabı görmez.
Ödeme yöntemi, siparişin otomatik gelir kaydının kategorisine de işlenir
("Satış · Nakit"), böylece finans ekranında nakit/kart ayrımı görünür. Kapatma
geçmişi silmez: `/yonetim/siparisler` tüm siparişleri "Ödendi · Nakit" rozetiyle
saklamaya devam eder.

**Masa aktarma.** Müşteri başka masaya geçtiğinde (güneş geldi, kalabalık oldu)
adisyon yeniden girilmez: `/hesaplar` ekranında masanın "Aktar" düğmesi açık
siparişlerin `tableNo` alanını hedef masaya taşır (`POST /api/hesaplar/aktar`).
Ödenmiş veya iptal edilmiş siparişlere dokunulmaz — geçmiş olduğu gibi kalır.
Varsayılan olarak masadaki tüm açık siparişler taşınır; masa bölündüyse yalnızca
gidenlerin siparişleri seçilebilir (kısmi aktarım), kalanlar eski masada açık kalır.
Hedef masada zaten açık bir hesap varsa iki adisyon **birleşir**; geri alınamadığı
için sunucu önce 409 + `needsMerge` döner ve işlem ancak açık onayla tamamlanır —
bu kontrol, arada hedef masaya sipariş düşme ihtimaline karşı yazma işleminin
içinde bir kez daha yapılır. Aktarım sonrası: KDS kartı yeni masayı ve "Masa 1 → 3
aktarıldı" izini gösterir, eski masanın müşteri ekranı boşalır (yeni masanın QR'ı
okutulmalı), zaten oluşmuş gelir kayıtlarının açıklaması da yeni masaya güncellenir.
Her aktarım `TableTransfer` tablosuna kim/ne zaman/ne kadar olarak yazılır ve
`/yonetim/hesaplar` altında "Son masa aktarımları" listesinde görünür.

**Garson siparişi.** QR kullanmak istemeyen müşteriler için personel `/siparis`
ekranından masa adına sipariş girer: masa numarasını seçer, aynı menüyü ve aynı
seçenek ekranını kullanır. Sunucu, isteği yapanın oturumu olup olmadığına bakarak
siparişi `source = "PERSONEL"` ve `takenById` ile damgalar — bu istemciden
taklit edilemez. Garson siparişlerinde personele push gönderilmez (zaten personel
girmiştir); KDS ve sipariş geçmişinde "Garson" rozetiyle görünür. Masa
değiştirildiğinde sepet otomatik boşalır, yanlış masaya sipariş gitmez.

**Roller.** İki rol var ve ayrım sunucu tarafında zorlanır — `/yonetim/*` altındaki
her sayfa `requireUser(["ADMIN"])` çağırır, garson bu adresleri elle yazsa bile
kendi ekranına yönlendirilir. Koruma tek yerde: her korumalı sayfanın kendi
`requireUser()` çağrısı ve her API ucunun `getCurrentUser()` kontrolü. Ayrıca bir
middleware katmanı **bilerek yok** — Edge çalışma ortamında token doğrulaması
sayfa katmanıyla ayrışıp sessiz yönlendirme döngülerine yol açabiliyor.

| | Yönetici | Garson |
|---|---|---|
| Sipariş ekranı (KDS) | ✓ | ✓ |
| Masa adına sipariş girme | ✓ | ✓ |
| Açık hesap / hesap kapatma | ✓ | ✓ |
| Ciro, kâr–zarar, gider, tedarikçi | ✓ | ✗ |
| Menü ve fiyat düzenleme | ✓ | ✗ |
| QR üretme, personel yönetimi | ✓ | ✗ |

Garson eklemek için `/yonetim/personel` → "Personel Ekle". Şifreyi yönetici belirler,
sonradan aynı ekrandan değiştirebilir. İşten ayrılan personel **silinmez, "Pasif"
yapılır** — böylece geçmiş siparişlerdeki kim-aldı bilgisi korunur; pasif hesap giriş
yapamaz. Sipariş geçmişi olan bir kullanıcı zaten silinemiyor, sistem uyarıyor.
Son aktif yönetici de yetkisiz bırakılamaz veya pasife alınamaz.

KDS'te garson için "Yalnızca benim aldıklarım" anahtarı var — açıkken sadece kendi
girdiği siparişleri görür. Kapalıyken (varsayılan) tüm siparişleri görür; QR'dan gelen
siparişlerin bir sahibi olmadığı için mutfak akışının bozulmaması adına varsayılan budur.

**Admin / garson ayrımı.** Açık hesaplar ekranı iki adresten sunulur: personel
`/hesaplar` adresinde tam ekran (geri oku KDS'e gider), yönetici ise
`/yonetim/hesaplar` adresinde panelin içinde kalır (alt gezinme korunur).
Yönetici `/hesaplar` adresine giderse otomatik olarak panel sürümüne yönlendirilir.

**İptal.** Üç seviyede çalışır:

- **Tek kalem iptali** — KDS'te her satırın sağındaki ✕. Sipariş silinmez, o kalem
  iptal işaretlenir (üstü çizili görünür), siparişin toplamı ve varsa gelir kaydı
  otomatik yeniden hesaplanır. Son aktif kalem de iptal edilirse sipariş komple
  iptale döner.
- **Sipariş iptali** — "İptal" düğmesi. Artık sadece bekleyen değil, **hazırlanmakta
  olan** siparişler için de var (müşteri kalkabilir). Siparişin kalemleri de iptal
  işaretlenir ki rapor tutarlı olsun.
- **Hesabı kapatılmış sipariş değiştirilemez** — para tahsil edilmiş olur. Hatalı
  tahsilat için finanstan elle iade girilir.

**İptal nedeni zorunludur** ve beş seçenekten biri seçilir: müşteri vazgeçti, yanlış
girildi, **fire/zayi**, ürün kalmadı, diğer. Fire ayrı tutulur çünkü tek maliyet
oluşturan iptal türü odur — döküldü veya yanlış hazırlandı demektir.

Her iptalde **kim, ne zaman, neden ve isteğe bağlı açıklama** kaydedilir.
`/yonetim/iptaller` bunu dönem filtresiyle raporlar: toplam iptal tutarı, fire tutarı,
nedene göre ve **kişiye göre** dağılım, ve satır satır döküm. Bu rapor kasıtlı
suistimali de görünür kılar — küçük bir işletmede erişimi kısıtlamak yerine şeffaf
tutmak daha pratik.

**Yeni sipariş uyarısı.** KDS ve yönetim panelinin üstünde iki düğme var: hoparlör
(ses) ve zil (push). Uygulama açıkken yeni sipariş gelince zil sesi çalar, telefon
titrer, sekme başlığı yanıp söner ve başlıkta "N yeni" rozeti belirir. Ses, tarayıcı
kuralları gereği ilk kez hoparlör düğmesine basılınca açılır.

**Sepet gruplaması.** Aynı ürün + aynı seçim kombinasyonu tek satırda toplanır;
farklı seçim yapılırsa ayrı satır olur (`buildLineId`).

**PWA.** `next-pwa` (`@ducanh2912/next-pwa`) ile service worker üretilir ve
`public/manifest.json` ile telefona "Ana ekrana ekle" yapılabilir. Service worker
sadece production build'de aktiftir (`npm run build && npm start`).

---

**Gider ve tedarikçi takibi.** `/yonetim/finans` üç sekmeden oluşur:

- **Hareketler** — "Gider Ekle" ile toptancı ödemesi, kira, fatura girersin. Her giderde
  kalem, tedarikçi, fatura/irsaliye no ve tarih alanları var. "Peşin ödendi" anahtarını
  kapatırsan kayıt **veresiye** olur: vade tarihi girer, tutar tedarikçinin cari hesabına
  borç yazılır. "Borçlar" filtresi ödenmemişleri süzer; her satırdaki "Öde" düğmesiyle
  tamamını veya bir kısmını ödersin.
- **Tedarikçiler** — toptancı kartları (yetkili, telefon, not) ve her birinin güncel
  borcu. Karta girince cari hesap ekstresi açılır: tüm alımlar, kalan borçları ve
  ödeme geçmişi. Alım eklemeyi doğrudan buradan da yapabilirsin.
- **Gider Kalemleri** — Hammadde, Kira, Personel gibi kalemleri kendin tanımlarsın.
  Seed 10 tane hazır kalem yükler. Kullanımda olan bir kalem silinemez, adı değiştirilebilir.

Muhasebe notu: bir gider **girildiği tarihte** gidere yazılır, ödendiği tarihte değil
(tahakkuk esası). Yani "bu ayın gideri" henüz ödemediğin faturaları da kapsar. Ne kadar
borcun kaldığını "Ödenmemiş borç" kartından ve özet ekranındaki uyarı kutusundan görürsün.

---

## Push bildirimi kurulumu (opsiyonel)

Uygulama kapalıyken de bildirim almak için:

```bash
npm run push:keys
```

Çıkan iki anahtarı `.env` dosyasına yaz:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BN...."
VAPID_PRIVATE_KEY="...."
VAPID_SUBJECT="mailto:senin@mailin.com"
```

Sonra `npm run db:push` (PushSubscription tablosu için) ve sunucuyu yeniden başlat.
KDS veya yönetim panelindeki zil düğmesine basıp izin ver — o cihaz artık bildirim alır.

Bilmen gerekenler:

- Service worker sadece production build'de çalışır: `npm run build && npm start`.
  Ayrıca push için sayfanın **https** üzerinden açılması gerekir (localhost istisna).
- iPhone/iPad'de push, siteyi Safari'den "Ana Ekrana Ekle" ile kurduktan sonra çalışır.
  Normal tarayıcı sekmesinde çalışmaz — bu Apple'ın kısıtı.
- Anahtarları girmezsen uygulama sorunsuz çalışmaya devam eder, sadece push gönderilmez;
  ses ve görsel uyarı yine de çalışır.

---

## Yayına alma — Docker + harici nginx (önerilen)

Tek VPS'te birden fazla proje çalışacaksa kurgu şu: **host'ta tek bir nginx**
80/443'ü tutar ve certbot orada çalışır; her proje kendi `docker compose` yığınında
`127.0.0.1`'de ayrı bir porta bağlanır. Konteynerler dışarıya hiç açılmaz.

```
İnternet → Cloudflare → host nginx (80/443)
                          ├── kafem.com        → 127.0.0.1:3010  (smartcafe)
                          ├── proje2.com       → 127.0.0.1:3020
                          └── proje3.com       → 127.0.0.1:3030
```

> Projeler sık sık gelip gidiyorsa Traefik veya nginx-proxy + acme-companion gibi
> konteynerleşmiş bir yönlendirici otomatik keşif sağlar. Üç beş sabit proje için
> host nginx daha az sihirli ve hata ayıklaması kolay — bu yüzden önerim bu.

### 1. Dosyalar

| Dosya | Ne yapar |
|---|---|
| `Dockerfile` | Çok aşamalı derleme, Next.js standalone çıktısı, Debian tabanlı (Prisma için sorunsuz) |
| `docker-entrypoint.sh` | Her açılışta `prisma migrate deploy` çalıştırıp sunucuyu başlatır |
| `docker-compose.yml` | `app` + `db` (+ bakım için `tools` profili) |
| `.env.docker.example` | Sunucuda `.env` olarak kopyalanacak şablon |

### 2. Kurulum

```bash
git clone <repo> /opt/smartcafe && cd /opt/smartcafe
cp .env.docker.example .env
nano .env                      # şifreler, NEXTAUTH_SECRET, NEXTAUTH_URL, APP_PORT

docker compose up -d --build   # migration'lar otomatik uygulanır
docker compose --profile tools run --rm tools npm run db:seed   # ilk kurulumda bir kez
docker compose logs -f app
```

Güncelleme: `git pull && docker compose up -d --build`.

**Şema değiştirdiysen migration üretmeyi unutma.** Bu depo migration düzeninde
(`prisma/migrations` klasörü var), yani konteyner açılışta yalnızca `migrate deploy`
çalıştırır: dosyası olmayan bir şema değişikliği veritabanına **gitmez**, uygulama
açılır ama her istekte `P2022 / The column ... does not exist` hatası verir. Doğru sıra:

```bash
# yerelde, şemayı değiştirdikten sonra
npm run db:migrate -- --name masa_aktarimi   # prisma/migrations altına SQL üretir
git add prisma/migrations && git commit && git push
# sunucuda
git pull && docker compose up -d --build
```

Konteyner açılışta şemayı veritabanıyla karşılaştırır; bir fark bulursa logda
`UYARI: VERITABANI SEMAYLA UYUSMUYOR` bloğunu ve eksik olanları yazar. Sunucu yine de
başlar, ama bu uyarıyı görürsen eksik migration'ı üretmen gerekir.

(`prisma/migrations` klasörü hiç yoksa açılışta `prisma db push` çalışır; veri kaybına
yol açacak bir değişiklikte durur ve konteyner açılmaz.)

Bakım komutları aynı şekilde:

```bash
docker compose --profile tools run --rm tools npm run db:durum
docker compose --profile tools run --rm tools npm run db:onar
```

> **`NEXT_PUBLIC_*` tuzağı:** bu değişkenler tarayıcı paketine **derleme anında**
> gömülür. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` veya `NEXT_PUBLIC_APP_TIMEZONE`
> değiştirirsen `.env`'i düzenlemek yetmez, `docker compose up -d --build` ile
> yeniden derlemen gerekir. Diğer değişkenler (secret, DB, VAPID_PRIVATE_KEY)
> çalışma anında okunur, yeniden başlatmak yeter.

### 3. Host nginx

`/etc/nginx/sites-available/kafem.com`:

```nginx
server {
    listen 80;
    server_name kafem.com;

    client_max_body_size 5M;   # ürün görseli yüklemesi (varsayılan 1M yetmez)

    location / {
        proxy_pass http://127.0.0.1:3010;   # .env'deki APP_PORT
        proxy_http_version 1.1;

        # Bu üçü ŞART: olmadan hız sınırı tüm kafeyi tek IP sanar
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Host              $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kafem.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d kafem.com
```

Cloudflare arkasındayken gerçek ziyaretçi IP'si `CF-Connecting-IP` başlığıyla gelir ve
uygulama önce ona bakar; nginx bu başlığı olduğu gibi geçirir.

### 4. Cloudflare

- **SSL/TLS: Full (strict)** — origin'de certbot sertifikası olmalı. *Flexible* kullanma,
  Cloudflare ile sunucun arası şifresiz kalır.
- HTTPS yönlendirmesi ve **HSTS**'i Cloudflare'de aç.
- **`/*` için "Cache Everything" kuralı kurma.** Oturumlu bir sayfa başka bir
  müşteriye servis edilebilir. Varsayılan ayar güvenli.
- Bot Fight Mode açıksa QR menüsünün engellenmediğini bir telefonla doğrula.

### 5. Yedekleme

Veri `pgdata` adlı docker volume'unda. Günlük cron:

```bash
0 4 * * * cd /opt/smartcafe && docker compose exec -T db \
  pg_dump -U smartcafe smartcafe | gzip > /var/backups/smartcafe-$(date +\%F).sql.gz
```

Geri yükleme:

```bash
gunzip -c /var/backups/smartcafe-2026-09-12.sql.gz | \
  docker compose exec -T db psql -U smartcafe -d smartcafe
```

Yedeği sunucu dışına da kopyala (rsync/S3). Aynı diskteki yedek yedek değildir —
ve **bir kez geri yüklemeyi mutlaka dene**.

### 6. Birden fazla proje için notlar

- Her projede `.env` içindeki `COMPOSE_PROJECT_NAME` ve `APP_PORT` farklı olsun;
  aksi halde konteyner adları ve volume'lar çakışır.
- Her yığının kendi Postgres'i var — izolasyon iyi, ama RAM'i ona göre planla
  (her Postgres ~50-100 MB). Tek ortak Postgres de kullanılabilir; o zaman
  `db` servisini kaldırıp `DATABASE_URL`'i ortak sunucuya yönlendir.
- **Tek `app` örneği çalıştır.** Hız sınırı sayaçları süreç belleğinde tutuluyor;
  `deploy.replicas` ile çoğaltırsan sınır bölünür.

---

## Alternatif: Docker'sız kurulum (systemd)

### 1. Migration düzenine geç (tek seferlik, yerelde)

`db push` şemanın geçmişini tutmaz; veri doluyken alan değiştirince uyarısız kayıp
yaşarsın. Yerelde bir kez:

```bash
npm run db:baseline
```

Sonrası: geliştirirken `npm run db:migrate -- --name aciklama`, sunucuda `npm run db:deploy`.

### 2. Sunucuda PostgreSQL

```bash
sudo apt install postgresql
sudo -u postgres createuser --pwprompt smartcafe
sudo -u postgres createdb -O smartcafe smartcafe
```

`DATABASE_URL="postgresql://smartcafe:SIFRE@localhost:5432/smartcafe"`

**Yedek al** — bu iş bilgin. Günlük cron yeter:

```bash
0 4 * * * pg_dump -U smartcafe smartcafe | gzip > /var/backups/smartcafe-$(date +\%F).sql.gz
```

Yedeği ayrıca sunucu dışına (S3, başka bir makine) kopyala. Aynı diskteki yedek yedek değildir.

### 3. Uygulamayı kur ve başlat

```bash
git clone <repo> /opt/smartcafe && cd /opt/smartcafe
npm ci
cp .env.example .env    # doldur (aşağıdaki tabloya bak)
npm run db:deploy
npm run db:seed         # ilk kurulumda bir kez
npm run build
```

`/etc/systemd/system/smartcafe.service`:

```ini
[Unit]
Description=SmartCafe OS
After=network.target postgresql.service

[Service]
Type=simple
User=smartcafe
WorkingDirectory=/opt/smartcafe
EnvironmentFile=/opt/smartcafe/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now smartcafe
sudo journalctl -u smartcafe -f    # log takibi
```

> **Tek süreç çalıştır.** Hız sınırı sayaçları süreç belleğinde tutuluyor; pm2 cluster
> ile birden fazla örnek açarsan sayaç bölünür ve sınır gevşer.

### 4. nginx

```nginx
server {
    listen 80;
    server_name kafem.com;

    # Ürün görseli yüklemesi için (varsayılan 1M yetmez)
    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Bu üç satır ŞART: olmadan hız sınırı herkesi tek IP sanar
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

Cloudflare kullanıyorsan gerçek ziyaretçi IP'si `CF-Connecting-IP` başlığında gelir ve
uygulama önce ona bakar. nginx'in Cloudflare IP aralıklarını `set_real_ip_from` ile
tanıması da iyi olur.

### 5. Cloudflare

- **SSL/TLS modu: Full (strict)** olsun; origin'e Let's Encrypt sertifikası kur
  (`certbot --nginx`). *Flexible* modu kullanma — Cloudflare ile sunucun arası şifresiz kalır.
- **HTTPS'e yönlendirme** ve **HSTS**'i Cloudflare tarafında aç.
- **Önbelleği HTML için açma.** "Cache Everything" gibi bir kural koyarsan bir
  müşterinin oturumlu sayfası başka birine servis edilebilir. Varsayılan ayar güvenli;
  `/*` için Cache Everything kuralı **kurma**.
- Bot Fight Mode'u açarsan QR menüsünün engellenmediğini bir telefonla doğrula.

### 6. Ortam değişkenleri

| Değişken | Değer |
|---|---|
| `DATABASE_URL` | Sunucudaki Postgres |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` — yereldekinden **farklı** olsun |
| `NEXTAUTH_URL` | `https://kafem.com` — tarayıcıdaki adresle birebir aynı |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Europe/Istanbul` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push kullanacaksan |

`NEXTAUTH_URL` yanlışsa giriş sessizce başarısız olur — en sık yaşanan hata budur.
Uygulama, `NEXTAUTH_SECRET` yoksa üretimde açılmayı reddeder (sessiz bozulmaktansa).

### 7. Yayın öncesi kontrol listesi

- [ ] `src/app/api/tani` klasörü silindi (teşhis ucu)
- [ ] `.env` dosyası repoya **girmedi** (`.gitignore` içinde, ayrıca `.dockerignore`'da)
- [ ] `npm run db:baseline` çalıştırıldı
- [ ] Postgres yedeği kuruldu **ve bir kez geri yükleme denendi**
- [ ] `NEXTAUTH_SECRET` üretim için ayrı üretildi
- [ ] `NEXTAUTH_URL` gerçek https adresi
- [ ] Varsayılan şifreler değiştirildi (`/yonetim/personel`)
- [ ] Cloudflare SSL "Full (strict)", HTML önbelleği kapalı
- [ ] nginx `X-Real-IP` / `X-Forwarded-For` gönderiyor
- [ ] `client_max_body_size 5M` ayarlandı (ürün görseli yüklemesi)
- [ ] Gerçek telefonla uçtan uca tur: QR → sipariş → KDS → hazırla → teslim →
      hesap kapat → finansta göründüğünü doğrula
- [ ] `/yonetim/qr` sayfasında site adresi gerçek alan adına çevrildi, QR'lar yeniden basıldı
- [ ] Deneme verisi temizlendi: `npm run db:temizle -- --tumu --onayla --numara-sifirla`

---

## Alternatif: Vercel

1. Projeyi GitHub'a at → vercel.com → Import Project.
2. Build Command: `npm run db:deploy && npm run build`.
3. Ortam değişkenlerini yukarıdaki tablodan gir.
4. Veritabanı olarak Supabase/Neon kullan (Vercel'de kalıcı disk yok).

---

## Güvenlik ve dayanıklılık notları

**Saat dilimi.** Günlük/aylık ciro sınırları sunucunun saatine göre değil, kafenin
saat dilimine göre hesaplanır (`src/lib/tz.ts`). Vercel UTC'de çalışsa bile "bugün"
Türkiye'de gece yarısı başlar. Farklı bir şehirdeysen `NEXT_PUBLIC_APP_TIMEZONE`
değiştirmen yeterli.

**Sipariş spam koruması.** QR menüsü giriş istemez — tasarım gereği. Buna karşılık
`POST /api/orders` üç katmanla korunur (`src/lib/rate-limit.ts`): aynı sepet 45 saniye
içinde tekrar gönderilemez (çift tıklama dahil), IP başına 10 dakikada 8 sipariş,
masa başına 10 dakikada 10 sipariş. Giriş yapmış personel bu sınırlara takılmaz.
Giriş denemeleri de e-posta başına 10 dakikada 10 ile sınırlı.

Bu sayaçlar sunucu belleğinde tutulur; Vercel'de birden fazla örnek çalışırsa sayaç
örnek başına ayrı olur. Küçük bir kafe için fazlasıyla yeterli; ciddi bir saldırı
beklentin olursa Upstash Redis gibi paylaşımlı bir sayaca geçilmeli.

**Güvenlik başlıkları.** `next.config.mjs` içinde `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy` ve `Permissions-Policy` gönderiliyor. HSTS'i Cloudflare tarafında aç.

**Bilinen sınırlar.** Para alanları `Float` (Prisma `Decimal` daha doğru olurdu; kafe
ölçeğinde fark etmez ama kuruş yuvarlaması teorik olarak birikebilir). Hata izleme
(Sentry vb.) kurulu değil — yayına aldıktan sonra eklemek faydalı olur. Ödenmiş
siparişler için iade akışı yok; hatalı tahsilat finanstan elle düzeltilir. Otomatik
test yok — değişiklik yaptıkça uçtan uca turu elle tekrarlaman gerekir.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Prisma client üretir + production build |
| `npm start` | Production sunucusu (PWA burada aktif) |
| `npm run db:push` | Şemayı veritabanına uygular |
| `npm run db:seed` | Örnek veri + kullanıcılar |
| `npm run db:studio` | Prisma Studio (veritabanı arayüzü) |
| `npm run db:durum` | Kayıt sayıları + tutarsızlık raporu (hiçbir şeyi değiştirmez) |
| `npm run db:onar` | Askıda kalmış sipariş ve eksik gelir kayıtlarını düzeltir |
| `npm run db:temizle` | Test verisini siler (aşağıya bak) |

### Veritabanı bakımı

Önce ne durumda olduğuna bak:

```bash
npm run db:durum
```

Tutarsızlık varsa (ödenmiş ama tamamlanmamış sipariş, geliri yazılmamış sipariş):

```bash
npm run db:onar
```

Test verisini temizlemek için — **kullanıcılar, menü ve gider kalemleri her zaman korunur**:

```bash
npm run db:temizle -- --siparisler                    # ne silineceğini gösterir, silmez
npm run db:temizle -- --siparisler --onayla           # siparişleri ve otomatik gelirleri siler
npm run db:temizle -- --tumu --onayla --numara-sifirla  # her şey + sipariş no 1'den başlar
```

Bayraklar: `--siparisler`, `--finans` (elle girilen gelir/gider + tedarikçi ödemeleri),
`--tedarikciler`, `--tumu`. `--onayla` olmadan hiçbir şey silinmez.

---

## Sonraki adımlar için fikirler

- Ürün görselleri için Supabase Storage / UploadThing entegrasyonu
- KDS'te yeni sipariş geldiğinde sesli uyarı ve web push bildirimi
- Adisyon/fiş yazıcısı (ESC/POS) entegrasyonu
- Masa bazlı açık hesap ve ödeme yöntemi (nakit/kart) kaydı
- Personel vardiya ve satış performansı raporu
