# Humanum Hukuk — Sunucu Kurulumu

Bu yapı uygulamayı müşteri sunucusunda Docker ile çalıştırmak içindir. Uygulama herhangi bir ücretli bulut hizmetine otomatik olarak bağlanmaz.

## Bileşenler

- `app`: Next.js uygulaması; yetkisiz sistem kullanıcısıyla çalışır.
- `database`: PostgreSQL; dış dünyaya port açmaz.
- `migrate`: Uygulama başlamadan önce veritabanı güncellemelerini bir kez uygular.
- `humanum_postgres_data`: Kalıcı veritabanı alanı.
- `humanum_documents`: İnternete açık olmayan kalıcı evrak alanı.

## İlk kurulum

1. `apps/web/.env.production.app.example` dosyasını `.env.production.app` adıyla kopyalayın.
2. `apps/web/.env.production.database.example` dosyasını `.env.production.database` adıyla kopyalayın.
3. Örnek parolaların tamamını birbirinden farklı, güçlü ve rastgele değerlerle değiştirin.
4. İki dosyadaki uygulama veritabanı parolasının aynı olduğundan emin olun.
5. `BETTER_AUTH_URL` değerini gerçek HTTPS adresiyle değiştirin.
6. Sunucunun ters proxy ayarında HTTPS adresini `127.0.0.1:3000` hedefine yönlendirin.
7. Depo kökünde `docker compose -f compose.production.yaml up -d --build` çalıştırın.

Gerçek `.env.production.*` dosyaları Git tarafından yok sayılır. Bu dosyaları GitHub'a eklemeyin ve sohbet/e-posta yoluyla paylaşmayın.

## Güvenlik ve yedekleme

- Veritabanı ve evrak volume'ları birlikte, düzenli ve şifreli biçimde yedeklenmelidir.
- Sunucu güvenlik duvarında yalnızca gerekli HTTPS ve yönetim portları açık olmalıdır.
- PostgreSQL portu internete açılmamalıdır.
- TLS sertifikası ters proxy katmanında yönetilmelidir.
- Güncellemeler önce yedek alınarak ve test ortamında doğrulanarak uygulanmalıdır.

## Olası dış maliyetler

Kod herhangi bir sağlayıcıya otomatik faturalandırma başlatmaz. Sunucu, alan adı, yedekleme alanı, SMS gönderimi ve seçilirse harici e-posta sağlayıcısı müşteri tarafından ayrıca temin edilir ve maliyetleri sağlayıcıya bağlıdır.
