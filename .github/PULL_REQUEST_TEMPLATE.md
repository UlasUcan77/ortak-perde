## Ne değişti? / What changed?

<!-- Kısa açıklama. İlgili issue: Closes #… -->

## Nasıl test edildi? / How was it tested?

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Elle denendi: ana ekran + en az iki telefon (veya iki tarayıcı penceresi) / Manually tested with host + 2 phones

## Kontrol listesi / Checklist

- [ ] Kullanıcıya görünen metinler `tr.json` ve `en.json`'a eklendi / UI strings added to both locales
- [ ] Yeni socket olayları zod şemasıyla doğrulanıyor, sunucu otoriter / New socket events are zod-validated, server stays authoritative
- [ ] 320 px genişlikte yatay kaydırma yok, `prefers-reduced-motion` destekleniyor / No horizontal scroll at 320 px, reduced motion respected
- [ ] UI değişikliği varsa ekran görüntüsü eklendi / Screenshots attached for UI changes
