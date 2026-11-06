# Güvenlik Politikası / Security Policy

## Desteklenen sürümler

Yalnızca `main` dalındaki en güncel sürüm güvenlik güncellemesi alır.

## Açık bildirme

Lütfen güvenlik açıklarını **herkese açık issue olarak açmayın.** Bunun yerine GitHub'ın **Private vulnerability reporting** özelliğini kullanın: depo sayfasında **Security → Report a vulnerability**.

Bildiriminize şunları ekleyin:

- Etkilenen bileşen (sunucu, web, shared) ve sürüm/commit
- Yeniden üretme adımları veya kavram kanıtı
- Olası etki

48 saat içinde yanıt vermeyi, 14 gün içinde bir düzeltme veya yol haritası paylaşmayı hedefliyoruz. Düzeltme yayımlandıktan sonra, isterseniz katkınızı teşekkür notunda belirtiriz.

## Kapsam ve tasarım ilkeleri

- Sunucu otoriterdir; tüm Socket.IO olayları zod ile doğrulanır.
- TMDB API anahtarı yalnızca sunucuda tutulur; istemciye, loglara veya hata mesajlarına yazılmamalıdır. Anahtarın sızdığı bir yol bulursanız bu bir güvenlik açığıdır.
- Kullanıcı verisi diske yazılmaz; odalar bellektedir.

## Reporting a vulnerability (English)

Please do not open public issues for security problems. Use **Security → Report a vulnerability** (GitHub private vulnerability reporting) on the repository page. We aim to respond within 48 hours.
