# 🎬 Ortak Perde

**"Bu akşam ne izleyelim?" tartışmasını bitiren, QR ile katılınan, kaydırmalı grup film seçici.**

[English README](README.en.md) · [Mimari kararlar](docs/DECISIONS.md) · [Yol haritası](docs/ROADMAP.md) · [Katkı rehberi](CONTRIBUTING.md)

Bir kişi siteyi TV'ye bağlı bilgisayarda açar, herkes QR'ı telefonuyla taratır, herkes kendi zevkine göre tür seçer ve aynı desteyi Tinder gibi kaydırır. Bitince büyük ekranda dramatik bir geri sayımla kazanan film açıklanır. Hesap yok, kayıt yok, reklam yok.

<!-- Ekran görüntüleri: docs/screenshots/ altına ekleyin, nasıl çekileceği aşağıda. -->

| Ana ekran (TV)                                     | Telefon                                           |
| -------------------------------------------------- | ------------------------------------------------- |
| `docs/screenshots/host-lobby.png` _(yer tutucu)_   | `docs/screenshots/phone-swipe.png` _(yer tutucu)_ |
| `docs/screenshots/host-results.png` _(yer tutucu)_ | `docs/screenshots/demo.gif` _(yer tutucu)_        |

> **Ekran görüntüsü / GIF nasıl çekilir:** `npm run dev` ile çalıştırın, ana ekranı 1920×1080 tarayıcı penceresinde açın, telefon görünümü için tarayıcının geliştirici araçlarında cihaz emülasyonunu (ör. iPhone 12, 390×844) kullanın. GIF için [Peek](https://github.com/phw/peek), [ScreenToGif](https://www.screentogif.com/) veya macOS'ta `Cmd+Shift+5` ile kayıt alıp `docs/screenshots/` altına koyun. Afişli görüntüler için `TMDB_API_KEY` tanımlı olmalı.

## Nasıl çalışır?

1. **Ana ekranı aç** — `/host` adresinde bir oda oluşur; büyük bir QR kod ve 4 karakterlik oda kodu (ör. `K7QX`) görünür.
2. **QR'ı tarat** — Herkes telefonuyla katılır, takma ad yazar ve emoji avatar seçer. QR okumayanlar `/join` sayfasına kodu yazabilir.
3. **Türünü seç** — Herkes kendi sevdiği türleri (veya "fark etmez") ve istersen "kesinlikle istemediklerini" seçer.
4. **Deste karıştırılır** — Sunucu, herkesin türlerinden eşit sayıda film gelecek şekilde round-robin ile **tek ve ortak** bir deste oluşturur (sıra herkese farklı karıştırılır).
5. **Kaydır** — Sağa = beğendim (1 puan), yukarı = süper (2 puan), sola = geç. Her oyuncunun oyun başına 1 **"ASLA"** vetosu vardır; veto edilen film kesin elenir. Son kaydırma bir adım geri alınabilir.
6. **Açıklama** — Herkes bitince (veya host "Şimdi bitir" deyince) ana ekranda 5-4-3-2-1 geri sayım ve kazanan film; podyum, "kimler beğendi" ve uyum oranı (ör. "4/5 kişi beğendi"). Sonuç PNG kartı olarak indirilebilir/paylaşılabilir.

Puanlama: toplam puan → beğenen kişi sayısı → süper beğeni sayısı → TMDB puanı → film id (deterministik). Herkesin beğendiği bir film yoksa sonuç **"Uzlaşma önerisi"** olarak etiketlenir; kimse hiçbir şeyi beğenmediyse "Bu gece sinema yok, dışarı çıkın!" der ve en yüksek puanlı vetosuz filmi teselli önerisi olarak sunar.

## Hızlı başlangıç

Gereksinim: Node.js 20.11+ (22 önerilir).

```bash
git clone https://github.com/UlasUcan77/ortak-perde.git
```

```bash
cd ortak-perde && npm install
```

```bash
npm run dev
```

Konsolda `📱 Telefonla bağlanmak için: http://192.168.x.x:5173` satırını göreceksiniz. Bilgisayarda `http://localhost:5173/host` adresini açın; QR kod otomatik olarak yerel ağ IP'sini kullanır (telefonlar ve bilgisayar aynı Wi-Fi ağında olmalı).

TMDB anahtarı olmadan da çalışır: 74 filmlik, afişsiz bir örnek veri seti kullanılır.

### TMDB API anahtarı alma

1. [themoviedb.org](https://www.themoviedb.org/signup) üzerinde ücretsiz hesap açın.
2. **Ayarlar → API** sayfasından bir API anahtarı isteyin (kişisel / eğitim amaçlı kullanım).
3. "API Key (v3 auth)" değerini **veya** "API Read Access Token" (v4) değerini kopyalayın — ikisi de çalışır.
4. `cp .env.example .env` ve `TMDB_API_KEY=` satırına yapıştırın, sunucuyu yeniden başlatın.

Anahtar yalnızca sunucuda durur; istemciye, loglara veya hata mesajlarına asla yazılmaz.

## Ortam değişkenleri

| Değişken          | Varsayılan | Açıklama                                                                                                                 |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `TMDB_API_KEY`    | _(boş)_    | TMDB v3 anahtarı veya v4 okuma jetonu. Boşsa örnek veri seti kullanılır.                                                 |
| `PUBLIC_URL`      | _(boş)_    | Telefonların açacağı genel adres, ör. `https://perde.example.com`. QR koda yazılır ve Socket.IO için izinli origin olur. |
| `PORT`            | `3000`     | Üretimde HTTP + WebSocket portu (tek port).                                                                              |
| `HOST`            | `0.0.0.0`  | Dinlenecek arayüz.                                                                                                       |
| `SERVER_PORT`     | `3000`     | Sadece geliştirmede: Vite'ın vekil ettiği API sunucusunun portu.                                                         |
| `WEB_PORT`        | `5173`     | Sadece geliştirmede: Vite portu.                                                                                         |
| `TMDB_REGION`     | `TR`       | İzleme platformları ve yayın tarihleri için bölge (ISO 3166-1).                                                          |
| `TRUST_PROXY`     | `false`    | Ters vekil arkasındaysanız `true` (IP rate limit'i için `X-Forwarded-For`'a güvenir).                                    |
| `ALLOWED_ORIGINS` | _(boş)_    | Virgülle ayrılmış ek izinli origin listesi.                                                                              |
| `LOG_LEVEL`       | `info`     | `fatal`, `error`, `warn`, `info`, `debug`.                                                                               |
| `WEB_DIST`        | _otomatik_ | Build edilmiş web arayüzünün yolu; `off` ile statik sunumu kapatır.                                                      |

### QR koddaki adres nasıl seçilir?

1. `PUBLIC_URL` tanımlıysa o.
2. Ana ekran `localhost`/`127.0.0.1` üzerinden açıldıysa sunucunun **yerel ağ IP'si** (aynı port ile — geliştirmede Vite portu 5173).
3. Ana ekran zaten erişilebilir bir adresle açıldıysa (`http://192.168.1.20:3000`, `https://alanadi.com`) o adres.
4. Hiçbiri yoksa QR yerine uyarı gösterilir — **localhost asla QR'a yazılmaz**.

## Komutlar

| Komut               | Ne yapar                                                                             |
| ------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`       | Sunucu (tsx watch) + Vite'ı birlikte başlatır, `0.0.0.0` üzerinde.                   |
| `npm run build`     | Web arayüzünü ve sunucuyu üretim için derler.                                        |
| `npm start`         | Derlenmiş uygulamayı tek süreç/tek port olarak çalıştırır (`http://localhost:3000`). |
| `npm test`          | Tüm paketlerde Vitest.                                                               |
| `npm run lint`      | ESLint + Prettier kontrolü.                                                          |
| `npm run typecheck` | Tüm paketlerde `tsc --noEmit`.                                                       |

## Docker ile çalıştırma

```bash
docker compose up --build
```

veya:

```bash
docker build -t ortak-perde . && docker run -p 3000:3000 -e TMDB_API_KEY=xxx -e PUBLIC_URL=http://192.168.1.20:3000 ortak-perde
```

Konteyner içinden ev ağınızın IP'si görülemeyeceği için Docker'da **`PUBLIC_URL`'i bilgisayarınızın LAN adresine** (ör. `http://192.168.1.20:3000`) ayarlayın ya da ana ekranı `localhost` yerine o adresle açın.

## Tek tıkla yayınla (Render)

[![Render'a yükle](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/UlasUcan77/ortak-perde)

1. Butona tıklayın ve GitHub hesabınızla Render'a giriş yapın.
2. Render, depodaki [`render.yaml`](render.yaml) dosyasını okuyup servisi hazırlar; sizden yalnızca `TMDB_API_KEY` ister (gizli değişken olarak saklanır).
3. **Apply / Deploy** deyin. Birkaç dakika sonra `https://ortak-perde-xxxx.onrender.com` adresi hazır olur; ana ekran için sonuna `/host` ekleyin.

`PUBLIC_URL` ve `TRUST_PROXY` ayarlamanız gerekmez: sunucu Render'ın verdiği adresi (`RENDER_EXTERNAL_URL`) QR için otomatik kullanır. Kendi alan adınızı bağlarsanız `PUBLIC_URL`'i o adrese ayarlayın.

## Self-host rehberi

Uygulama tek bir Node.js süreci olarak çalışır (HTTP + WebSocket aynı portta), veritabanı gerekmez. WebSocket destekleyen her platformda çalışır. Odalar bellekte tutulduğu için **tek örnek (instance)** çalıştırın; yatay ölçekleme için sticky session + ortak adapter gerekir (bkz. [ROADMAP](docs/ROADMAP.md)).

- **Render:** En kolayı yukarıdaki butondur. Elle kurmak için "New Web Service" → repo → Runtime: Docker; ortam değişkeni olarak yalnızca `TMDB_API_KEY` yeterli. Ücretsiz planda servis bir süre kullanılmayınca uykuya geçer; uyanması yaklaşık bir dakika sürer ve açık odalar silinir.
- **Fly.io:** `fly launch` (Dockerfile'ı algılar), `internal_port = 3000`, `fly secrets set TMDB_API_KEY=... PUBLIC_URL=https://<app>.fly.dev TRUST_PROXY=true`. `min_machines_running = 1` ve tek makine kullanın.
- **Railway:** Repo'yu bağlayın, Dockerfile otomatik kullanılır; `PORT` Railway tarafından verilir. Değişkenler: `TMDB_API_KEY`, `PUBLIC_URL`, `TRUST_PROXY=true`.
- **Kendi sunucunuz:** Docker ile çalıştırıp önüne Caddy/Nginx koyun; WebSocket upgrade başlıklarını iletin (`/socket.io/`). HTTPS kullanıyorsanız `PUBLIC_URL` https ile başlamalı (HSTS bu durumda açılır).

Vercel gibi serverless platformlar kalıcı WebSocket bağlantısı tutamadığı için **desteklenmez**.

## Mimari özeti

```
packages/shared   Tipler, Socket.IO olay adları + zod şemaları, puanlama ve deste oluşturma (saf fonksiyonlar)
apps/server       Fastify + Socket.IO, bellek içi oda yöneticisi, TMDB istemcisi + örnek veri, statik web sunumu
apps/web          Vite + React + Tailwind + framer-motion; /host (TV) ve /join/:kod (telefon) deneyimleri
```

- **Sunucu otoriterdir.** İstemci yalnızca niyet bildirir (`player:swipe` vb.); her olay zod ile doğrulanır, aşama dışı olaylar reddedilir, durum yalnızca sunucuda değişir. Her istemci kendi görünümünü alır (`room:state`): kimin neyi beğendiği sonuç açıklanana kadar kimseye gönderilmez.
- **Aşamalar:** `LOBBY → PICKING → BUILDING → SWIPING → REVEALING → RESULTS`.
- **Dayanıklılık:** Oyuncu/host jetonları `localStorage`'da; telefon kilitlenip sayfa yenilense de aynı oyuncu olarak kaldığı yerden devam eder. Host koparsa oda 10 dakika bekler; 3 saati aşan veya boş kalan odalar temizlenir.
- **TMDB:** Tür listesi ve keşif sonuçları TTL'li bellek önbelleğinde; eşzamanlı istek sınırı ve 429'da `Retry-After`'a saygı. TMDB'ye ulaşılamazsa örnek veriye düşülür.

Ayrıntılar: [docs/DECISIONS.md](docs/DECISIONS.md) ve [CLAUDE.md](CLAUDE.md).

## Gizlilik

- Hesap, çerez takibi, analitik ve reklam **yoktur**.
- Sunucu hiçbir kullanıcı verisini diske yazmaz; takma adlar, seçimler ve kaydırmalar yalnızca bellekte durur ve oda kapanınca silinir. İstek bazlı HTTP logları kapalıdır.
- Tarayıcıda yalnızca oturum jetonu, son kullanılan takma ad/avatar ve dil tercihi `localStorage`'da saklanır.
- Fontlar uygulamayla birlikte sunulur (üçüncü taraf font isteği yok). Afişler TMDB'nin görsel sunucusundan (`image.tmdb.org`) yüklenir.

## Güvenlik

Zod ile girdi doğrulama, isimlerde kaçışlama/temizleme, Socket.IO için origin kontrolü (`PUBLIC_URL`/aynı origin), Helmet güvenlik başlıkları ve CSP, IP başına oda oluşturma limiti. Açık bildirmek için [SECURITY.md](SECURITY.md).

## TMDB atfı

<img src="apps/web/public/tmdb-logo.svg" alt="TMDB" height="14" />

Bu ürün TMDB API'sini kullanır ancak TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. Film verileri ve afişler [The Movie Database (TMDB)](https://www.themoviedb.org/) kaynaklıdır; izleme platformu bilgileri TMDB üzerinden JustWatch tarafından sağlanır.

## Lisans

[MIT](LICENSE)
