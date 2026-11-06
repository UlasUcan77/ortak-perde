# Yol haritası / Roadmap

Fikirler, kabaca öncelik sırasıyla. Küçük ve başlangıca uygun görevler için [GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md).

## Yakın vade

- **Dizi desteği:** TMDB `/discover/tv` ile "Film / Dizi" seçimi; puanlama aynı.
- **Ağırlıklı oy modu:** süper beğeni puanının host tarafından ayarlanması, "veto yok" modu.
- **Ses efektleri:** geri sayım, açıklama ve kaydırma sesleri (sessiz mod varsayılan, kullanıcı açar).
- **Daha fazla dil:** Almanca, İspanyolca, Arapça (RTL düzeni dahil).
- **Tema seçenekleri:** sinema (varsayılan), açık tema, yüksek kontrast.
- **Daha zengin kart:** fragman bağlantısı (TMDB videos), yönetmen/oyuncular.

## Orta vade

- **Turnuva modu:** ilk turun ilk 8 filmiyle ikinci, daha kısa bir eleme turu.
- **"Ne izlemiştik?" hafızası:** kullanıcının kendi tarayıcısında (localStorage) geçmiş kazananlar; sunucuya veri gitmeden.
- **PWA:** ana ekrana ekleme, çevrimdışı açılış ekranı.
- **Erişilebilirlik denetimi:** ekran okuyucularla tam tur testi, Playwright + axe ile otomatik kontroller.
- **Uçtan uca tarayıcı testleri:** Playwright ile host + 3 telefon senaryosu CI'da.

## Uzun vade

- **Yatay ölçekleme:** Socket.IO Redis adapter + sticky session, odaların Redis'te TTL ile tutulması (hâlâ kalıcı kullanıcı verisi yok).
- **Uzaktan izleme partisi:** aynı odada farklı şehirlerden katılım için sesli/emoji tepkiler.
- **Eklenebilir katalog sağlayıcıları:** TMDB dışında açık veri kaynakları (ör. Wikidata) için `MovieCatalog` arayüzü üzerinden eklentiler.
