# Good first issues

Her biri GitHub'da ayrı bir issue olarak açılabilecek küçük, kendi içinde tamamlanan görevler. Format: **başlık**, kısa açıklama, kabul kriterleri. Etiket önerisi: `good first issue` + alan etiketi.

---

## 1. Yeni dil ekle: Almanca (de)

`apps/web/src/i18n/locales/de.json` dosyasını `en.json`'dan kopyalayıp çevir ve dili kaydet.

**Kabul kriterleri**

- [ ] `de.json` tüm anahtarları içeriyor (eksik anahtar yok; `en.json` ile aynı yapı).
- [ ] `SUPPORTED_LANGUAGES` ve `resources` içine eklendi; dil seçicide "DE" görünüyor.
- [ ] Tarayıcı dili `de-*` olan kullanıcıya otomatik Almanca açılıyor.
- [ ] TMDB isteklerinde dil eşlemesi (`tmdbLanguage`) `de-DE` döndürüyor.

## 2. İkinci avatar seti: hayvanlar yerine yiyecekler

Join ekranına "set" seçimi ekle (🐼 hayvanlar / 🍕 yiyecekler). Avatar listesi `packages/shared/src/constants.ts` içinde.

**Kabul kriterleri**

- [ ] Yeni avatarlar sunucu tarafında da doğrulanıyor (zod `AVATARS`).
- [ ] Seçilen set tarayıcıda hatırlanıyor (`localStorage`).
- [ ] 320 px genişlikte yatay kaydırma yok.

## 3. Ses efektleri (varsayılan kapalı)

Geri sayım tik sesi, kazanan açıklama sesi ve kaydırma "swoosh"u. Telifsiz (CC0) sesler veya Web Audio ile sentezlenmiş sesler kullan.

**Kabul kriterleri**

- [ ] Host ekranında bir "🔇/🔊" düğmesi var, tercih hatırlanıyor, varsayılan sessiz.
- [ ] Ses dosyaları < 50 KB ve lisansları `docs/` altında belirtilmiş (veya Web Audio ile üretiliyor).
- [ ] `prefers-reduced-motion` durumunu bozmuyor; otomatik oynatma politikası hatası yok.

## 4. Sonuç kartı temaları

`apps/web/src/lib/shareCard.ts` şu an tek tema çiziyor. "Sinema (koyu)" ve "Gün ışığı (açık)" temaları ekle.

**Kabul kriterleri**

- [ ] Host sonuç ekranında tema seçimi var, PNG seçilen temayla çiziliyor.
- [ ] Her iki temada metin kontrastı WCAG AA (4.5:1).
- [ ] TMDB atfı her temada kartın altında görünüyor.

## 5. "Ağırlıklı oy" modu

Host ayarlarına "süper beğeni puanı" (2 / 3) seçeneği ekle.

**Kabul kriterleri**

- [ ] Ayar `RoomSettings`'e eklendi, zod şemasıyla doğrulanıyor.
- [ ] `computeResults` puanı ayardan alıyor; mevcut testler geçiyor, yeni değer için test eklendi.
- [ ] Sonuç ekranında puanlar doğru gösteriliyor.

## 6. Daha fazla yayın platformu ve bölge seçimi

Host ayarlarına bölge seçimi (TR, DE, US, GB…) ekle; platform listesi seçilen bölgeye göre yenilensin.

**Kabul kriterleri**

- [ ] `region` ayarı UI'dan değiştirilebiliyor; `/api/meta?region=` ilgili platformları döndürüyor.
- [ ] `PREFERRED_PROVIDER_NAMES` listesine yeni bölgelerin popüler servisleri eklendi.
- [ ] Bölge değişince seçili ama artık geçersiz platformlar temizleniyor.

## 7. Dizi desteği (ilk adım: "Film / Dizi" anahtarı)

TMDB `/discover/tv` uç noktasıyla dizi destesi oluşturma.

**Kabul kriterleri**

- [ ] Host ayarlarında "Film / Dizi" seçimi var.
- [ ] `TmdbCatalog` dizi alanlarını (`name`, `first_air_date`, `episode_run_time`) `Movie` tipine eşliyor.
- [ ] Örnek veri modunda seçenek devre dışı ve açıklaması var.
- [ ] Testler: dizi eşlemesi için birim testi.

## 8. Tema seçenekleri: yüksek kontrast

Görme güçlüğü olanlar için yüksek kontrastlı bir tema (`data-theme="contrast"`).

**Kabul kriterleri**

- [ ] Tailwind renk belirteçleri CSS değişkenlerine taşındı ve tema değişince güncelleniyor.
- [ ] Tema dil seçicinin yanındaki düğmeyle değişiyor ve hatırlanıyor.
- [ ] Tüm metinler 7:1 kontrast (WCAG AAA) sağlıyor.

## 9. Kartta fragman bağlantısı

TMDB `videos` verisinden YouTube fragmanı varsa kart özetinin altında "▶ Fragman" bağlantısı göster.

**Kabul kriterleri**

- [ ] `enrich` isteğine `videos` eklendi (`append_to_response=watch/providers,videos`).
- [ ] Bağlantı yeni sekmede açılıyor (`rel="noopener noreferrer"`), kaydırmayı tetiklemiyor.
- [ ] Fragman yoksa hiçbir şey gösterilmiyor; örnek veri modunda gizli.

## 10. Host'tan oyuncu çıkarma

Lobide host, bir oyuncunun kartına basılı tutarak/× ile onu odadan çıkarabilsin.

**Kabul kriterleri**

- [ ] Yeni olay `host:kick { playerId }` shared protokolüne ve zod şemasına eklendi.
- [ ] Sadece LOBBY ve PICKING aşamasında izinli; diğerlerinde `WRONG_PHASE`.
- [ ] Çıkarılan oyuncu "Odadan çıkarıldın" mesajı görüyor ve jetonu geçersizleşiyor.
- [ ] Sunucu testi eklendi.

## 11. Bağlantı kalitesi göstergesi

Telefonda bağlantı koptuğunda zaten bir bant çıkıyor; ek olarak host ekranında oyuncunun "son görülme" süresini göster.

**Kabul kriterleri**

- [ ] `PlayerPublic`'e `lastSeenAt` eklendi (sunucu saatine göre değil, "N sn önce" olarak).
- [ ] 30 saniyeden uzun kopmalarda host'ta "📵 30 sn" rozeti görünüyor.

## 12. QR kodu tam ekran gösterme

Uzaktan okumayı kolaylaştırmak için lobide QR'a tıklayınca tam ekran ve maksimum boyutta gösterilsin.

**Kabul kriterleri**

- [ ] QR'a tıklama / Enter tuşu tam ekran katman açıyor, Esc kapatıyor.
- [ ] Odak katmana taşınıyor ve kapanınca geri dönüyor (erişilebilirlik).
- [ ] Oda kodu katmanda da büyük puntoyla görünüyor.
