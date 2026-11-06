# Mimari kararlar / Design decisions

Kısa, gerekçeli notlar. Yeni önemli bir karar verdiğinizde buraya ekleyin.

## Yığın

- **npm workspaces monorepo** (`packages/shared`, `apps/server`, `apps/web`). Ek bir monorepo aracı (turbo, nx) yok; üç paket için gereksiz.
- **Shared paket TypeScript kaynağı olarak tüketilir** (`exports: ./src/index.ts`). Vite ve tsx doğrudan derler; sunucu üretim build'inde `tsup` shared'ı pakete gömer. Böylece ayrı bir shared build adımı ve sıralama sorunu yok. `sideEffects: false` sayesinde web paketine zod şemaları girmez.
- **Güncel ve açık içermeyen sürümler:** Kurulum sırasında eski majör sürümler bilinen güvenlik açıkları içerdiği için `zod 4`, `vite 8`, `vitest 5`, `@fastify/static 10`, `react-router 7` seçildi. React 18, Tailwind 3 ve TypeScript 5 bilinçli olarak tutuldu (geniş ekosistem uyumu). Transitive `minimatch` için `overrides` kullanılır.
- **Fontlar self-host** (`@fontsource-variable/*`, OFL): Google Fonts'a istek atılmaz, gizlilik ve CSP için daha iyi.

## Oyun ve protokol

- **İstemci → sunucu olayları ack kullanır** (`{ ok: true, data } | { ok: false, error }`). Spesifikasyondaki `room:created` ve `player:joined` olayları ayrı olay yerine `host:create-room` / `player:join` olaylarının ack yanıtıdır. `game:results` ayrı bir olay değil, `room:state` içindeki `results` alanıdır (tek doğruluk kaynağı).
- **Deste ayrı olay:** `game:deck` destedeki filmleri bir kez (ve yeniden bağlanınca) yollar; her kaydırmada yayınlanan `room:state` küçük kalır.
- **Görünümler rol bazlı:** host ve her oyuncu kendine özel `room:state` alır. Başkalarının kaydırmaları hiçbir zaman istemciye gönderilmez; sonuçlar host'a REVEALING'de, oyunculara RESULTS'ta gider.
- **Katılım yalnızca LOBBY'de.** "Ayarları değiştir" odayı LOBBY'ye döndürür; yeni gelenler o zaman katılabilir. Geri bağlanma her aşamada açık.
- **PICKING → BUILDING:** herkes hazır olunca otomatik, ya da host "Hazır olanlarla devam et" der (en az 1 hazır oyuncu). Tür seçmemiş oyuncular "fark etmez" sayılır.
- **SWIPING → REVEALING:** tüm oyuncular bitirince (bağlantısı kopmuş oyuncular da beklenir) veya host "Şimdi bitir" der. Kilitli telefon yüzünden oyunun erken bitmemesi için çevrimdışı oyuncu beklenir; host karar verir.
- **REVEALING 8 saniye sürer** (5 sn geri sayım + 3 sn açıklama) ve sunucu RESULTS'a kendisi geçer. Geri sayım istemcide yerel zamanlayıcıyla çalışır; saat farkı sorun olmaz.
- **"Yeniden oyna"** aynı tercihlerle doğrudan yeni deste kurar (önceki turlarda gösterilen filmler önce dışlanır); **"Ayarları değiştir"** LOBBY'ye döner, tercihler korunur.
- **Veto** o anki (henüz kaydırılmamış) kartı "geç" olarak işaretleyip veto eder; geri alınamaz. **Geri al** yalnızca bir adım; arka arkaya iki geri alma yok.

## Puanlama

- `like = 1`, `super = 2`, `nope = 0`; vetolu film elenir.
- Sıralama: puan → beğenen sayısı → süper sayısı → TMDB puanı → id (artan).
- **"Katılımcı"** = en az bir kart kaydıran veya veto kullanan oyuncu. Hiç kaydırmadan oyun bitirilen kişiler oybirliği hesabını bozmaz.
- **Oybirliği varsa** (tüm katılımcılar beğendiyse) kazanan bu filmler arasından seçilir — daha yüksek puanlı ama tartışmalı bir film yerine herkesin ortak beğendiği tercih edilir. Yoksa en yüksek puanlı film "Uzlaşma önerisi" olur. Hiç puan yoksa "Bu gece sinema yok" + vetosuz en yüksek TMDB puanlı film.

## Deste oluşturma

- Her oyuncunun sevdiği türler için TMDB `discover`'dan popülerliğe göre 2 sayfa (≈40 film) çekilir, tur tohumuyla karıştırılır. Ayrıca bir "genel havuz" (tür filtresiz) çekilir.
- Round-robin: her turda her oyuncu, kendi türleri arasında dönerek bir film ekler → katkılar eşit (±1).
- Sırayla geçişler: (1) oyuncu türleri, görülmemiş, istenmeyen tür yok → (2) önceki turlarda görülenler de olabilir → (3) genel havuzdan dolgu → (4) hâlâ deste boyutunun **yarısından azsa** istenmeyen tür kuralı gevşetilir ve host'a bildirilir. Yarısı veya fazlası kaldıysa kural korunur, deste daha kısa olabilir ("Filtrelere uyan sadece N film").
- Bilinmeyen tür id'leri sunucuda yok sayılır (keyfi TMDB isteklerini önlemek için).
- Örnek veri modunda platform filtresi uygulanamaz; host'a not düşülür.

## QR ve ağ

- Öncelik: `PUBLIC_URL` → (ana ekran localhost'tan açıldıysa) LAN IP + aynı port → ana ekranın kendi origin'i. Spesifikasyondaki sıradan küçük bir sapma: ana ekran zaten erişilebilir bir adresten (alan adı veya LAN IP) açıldıysa o adres LAN IP'ye tercih edilir; aksi hâlde konteyner/bulut ortamında yanlış (iç) bir IP QR'a yazılırdı. localhost hiçbir zaman QR'a yazılmaz.
- Geliştirmede herkese açık port Vite'ınkidir (5173); API sunucusu `SERVER_PORT` (3000) üzerinde Vite proxy arkasında durur. Sunucu `--dev` bayrağıyla `PORT` yerine `SERVER_PORT`'u okur — böylece Vite için verilen bir `PORT` çakışmaz.
- LAN IP seçiminde sanal adaptörler (WSL, Docker, VirtualBox, Tailscale…) düşük puan alır.

## Güvenlik ve gizlilik

- Socket.IO bağlantıları `allowRequest` ile origin kontrolünden geçer: aynı origin, `PUBLIC_URL` veya `ALLOWED_ORIGINS`. Origin başlığı olmayan (tarayıcı dışı) istemciler kabul edilir.
- Jetonlar `crypto.randomBytes` ile, karşılaştırma `timingSafeEqual` ile.
- İsimler: kontrol/biçim karakterleri ve `<>"'\`&\\/{}` silinir, 16 karaktere (grafem değil kod noktası) kısaltılır, aynı isim varsa " 2" eklenir. React zaten kaçışlar; bu ek savunmadır.
- HTTP istek logları kapalı (IP ve oda kodu loglanmasın diye). TMDB hata mesajları URL içermez (v3 anahtarı sorgu parametresindedir).
- HSTS yalnızca `PUBLIC_URL` https ise açılır; LAN üzerinde http ile kullanım bozulmasın.
- Poster proxy'si (`/api/poster/w500/...`) yalnızca TMDB modunda ve sıkı bir yol desenine uyan istekler için; paylaşım kartı canvas'ı CORS yüzünden "kirlenmesin" diye gerekli.

## Arayüz

- Host ekranı faz geçişlerinde **çıkış animasyonu beklemez**: arka plandaki sekmelerde veya `requestAnimationFrame`'i kısan TV tarayıcılarında `AnimatePresence mode="wait"` geçişi kilitliyordu.
- Kaydırmalar iyimser (optimistic) uygulanır; sunucu reddederse kart geri gelir. Hızlı ardışık dokunuşlar senkron bir referansla aynı kartı iki kez göndermez.
- Sayfalar tembel yüklenir: telefonlar QR kodlayıcı ve host ayarlarını indirmez.
- `prefers-reduced-motion`: konfeti kapanır, kart dönmesi ve giriş animasyonları kapanır; CSS animasyonları neredeyse sıfıra iner.

## Yayınlama

- **Render blueprint (`render.yaml`)** tek tıkla kurulum sağlar. `PUBLIC_URL` boşsa Render'ın otomatik verdiği `RENDER_EXTERNAL_URL` QR adresi olarak kullanılır; `RENDER` ortam değişkeni varken `TRUST_PROXY` açıkça kapatılmadıkça açık kabul edilir. Böylece kullanıcının girmesi gereken tek değer `TMDB_API_KEY` olur.
