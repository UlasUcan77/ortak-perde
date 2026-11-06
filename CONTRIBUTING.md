# Katkı rehberi / Contributing

Katkılarınız için teşekkürler! 🎬 Türkçe veya İngilizce yazabilirsiniz.

## Geliştirme ortamı

- Node.js 20.11+ (22 önerilir), npm 10+.
- `npm install` → `npm run dev` → `http://localhost:5173/host`.
- TMDB anahtarı gerekmez; anahtar yoksa 74 filmlik örnek set kullanılır. Afişlerle denemek için `.env.example`'ı `.env` olarak kopyalayıp `TMDB_API_KEY` ekleyin.
- Telefonla denemek için: telefon ve bilgisayar aynı Wi-Fi'da olmalı; konsoldaki `📱 Telefonla bağlanmak için` adresini açın. Tek bilgisayarda birden fazla oyuncu denemek için farklı origin'ler kullanın (ör. `localhost:5173`, `127.0.0.1:5173` ve LAN IP'si) — oturum jetonları origin başına saklanır.

## Proje yapısı

```
packages/shared   tipler, olay adları, zod şemaları, puanlama ve deste (saf, testli)
apps/server       Fastify + Socket.IO, RoomManager, TMDB istemcisi, örnek veri
apps/web          React arayüzü: /host (TV) ve /join/:kod (telefon)
```

Önce [CLAUDE.md](CLAUDE.md) ve [docs/DECISIONS.md](docs/DECISIONS.md) dosyalarına göz atın.

## Kod stili

- TypeScript strict, `any` yok. Tip importları `import type` ile.
- Biçim: Prettier (`npm run format`). Lint: ESLint (`npm run lint`).
- **Sunucu otoriterdir:** oyun kuralları `RoomManager`'da ve `packages/shared`'daki saf fonksiyonlarda yaşar; istemci yalnızca niyet gönderir. Yeni bir olay eklerken:
  1. `packages/shared/src/protocol.ts`'te olay adını, zod şemasını ve `ClientToServerEvents` tipini ekleyin.
  2. `apps/server/src/socket.ts`'te `on(EVENTS.x, schema, handler)` ile kaydedin; kural `RoomManager` içinde.
  3. Aşama kontrolü yapın ve hata kodu döndürün (`WRONG_PHASE` vb.), istisna fırlatmayın.
  4. Sunucu testi ekleyin.
- Kullanıcıya görünen her metin i18n anahtarıdır; Türkçe ve İngilizce dosyalarına birlikte ekleyin.
- Erişilebilirlik: her etkileşim butonla da yapılabilmeli, ikon butonlarda `aria-label`, `prefers-reduced-motion`'a saygı, 320 px'de yatay kaydırma yok.

## Testler

```bash
npm test               # hepsi
npm test -w @ortak-perde/shared
npm test -w @ortak-perde/server
npm test -w @ortak-perde/web
```

PR göndermeden önce: `npm run lint && npm run typecheck && npm test && npm run build`. CI aynısını çalıştırır.

## Commit formatı

[Conventional Commits](https://www.conventionalcommits.org/tr/v1.0.0/):

```
feat(web): QR'ı tam ekran gösterme
fix(server): host yeniden bağlanınca eski soketi düşür
docs: self-host rehberine Caddy örneği
test(shared): eşitlik bozma kuralları
```

Kapsamlar: `shared`, `server`, `web`, `docs`, `ci`, `deps`.

## Yeni dil ekleme

1. `apps/web/src/i18n/locales/en.json` dosyasını `xx.json` olarak kopyalayın ve çevirin (anahtarları değiştirmeyin; `_one`/`_other` çoğul eklerini koruyun).
2. `apps/web/src/i18n/index.ts` içinde `resources` ve `SUPPORTED_LANGUAGES` listesine ekleyin.
3. TMDB içerik dili için `apps/server/src/catalog/types.ts` içindeki `tmdbLanguage` eşlemesini ve `Locale` tipini (`packages/shared/src/types.ts`) güncelleyin; `createRoomSchema`'daki `locale` enum'una ekleyin.
4. Sunucudaki yedek tür adları için `apps/server/src/catalog/genre-names.ts` ve örnek veri başlık/özetleri isteğe bağlıdır (yoksa Türkçe'ye düşer).

## Pull request

- Küçük ve odaklı PR'lar tercih edilir; ilgili issue'yu bağlayın.
- UI değişikliklerinde ekran görüntüsü ekleyin (host + telefon).
- Davranış kuralları: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
