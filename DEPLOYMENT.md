# Humanum Hukuk — Sunucu Kurulumu

Bu yapı uygulamayı müşteri sunucusunda Docker ile çalıştırmak içindir. Uygulama herhangi bir ücretli bulut hizmetine otomatik olarak bağlanmaz.

## Bileşenler

- `app`: Next.js uygulaması; yetkisiz sistem kullanıcısıyla çalışır.
- `database`: PostgreSQL; dış dünyaya port açmaz.
- `migrate`: Uygulama başlamadan önce veritabanı güncellemelerini bir kez uygular.
- `SMTP`: E-posta doğrulama ve şifre yenileme iletilerini gönderen, müşteri tarafından seçilecek posta hizmetidir.
- `humanum_postgres_data`: Kalıcı veritabanı alanı.
- `humanum_documents`: İnternete açık olmayan kalıcı evrak alanı.

## İlk kurulum

1. `apps/web/.env.production.app.example` dosyasını `.env.production.app` adıyla kopyalayın.
2. `apps/web/.env.production.database.example` dosyasını `.env.production.database` adıyla kopyalayın.
3. `apps/web/.env.production.migration.example` dosyasını `.env.production.migration` adıyla kopyalayın; bu dosyada yalnızca migrasyon ve gölge veritabanı bağlantıları bulunmalıdır.
4. Örnek parolaların tamamını birbirinden farklı, güçlü ve rastgele değerlerle değiştirin.
5. Uygulama, migrasyon ve veritabanı yönetici parolalarının birbirinden farklı olduğundan emin olun.
6. `BETTER_AUTH_URL` değerini gerçek HTTPS adresiyle değiştirin.
7. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` ve `SMTP_FROM` değerlerini e-posta sağlayıcısına göre doldurun.
8. Gönderici alan adında SPF, DKIM ve DMARC kayıtlarını e-posta sağlayıcısının talimatlarına göre tamamlayın.
9. Sunucunun ters proxy ayarında HTTPS adresini `127.0.0.1:3000` hedefine yönlendirin.
10. Depo kökünde `docker compose -f compose.production.yaml up -d --build` çalıştırın.

Yeni kullanıcılar e-posta adreslerini doğrulamadan oturum açamaz. Kurulumdan sonra gerçek bir kullanıcıyla hem doğrulama hem şifre yenileme e-postasının teslim edildiğini test edin.

Gerçek `.env.production.*` dosyaları Git tarafından yok sayılır. Bu dosyaları GitHub'a eklemeyin ve sohbet/e-posta yoluyla paylaşmayın.

## Güvenlik ve yedekleme

- Veritabanı ve evrak volume'ları birlikte, düzenli ve şifreli biçimde yedeklenmelidir.
- Sunucu güvenlik duvarında yalnızca gerekli HTTPS ve yönetim portları açık olmalıdır.
- PostgreSQL portu internete açılmamalıdır.
- TLS sertifikası ters proxy katmanında yönetilmelidir.
- SMTP bağlantısı production ortamında TLS ve kimlik doğrulama kullanmalıdır.
- Güncellemeler önce yedek alınarak ve test ortamında doğrulanarak uygulanmalıdır.

## E-posta kötüye kullanım koruması

Doğrulama ve şifre yenileme istekleri IP/yol bazında veritabanında sınırlandırılır; uygulamayı yeniden başlatmak sayaçları temizlemez. Aynı adres ve işlem türü için ayrıca 60 saniye bekleme, 15 dakikada 3 ve 24 saatlik pencerede 10 istek sınırı vardır. Kayıtlı olmayan adreslere e-posta gönderilmez; tekrar istekleri de aynı genel başarı yanıtını alır.

SMTP gönderim noktasında adres/işlem türü başına dakikada 1 ve saatte 3 deneme, tüm sistemde saatte 50 deneme sınırı uygulanır. Adres/işlem türü başına günlük kabul edilen gönderim sınırı 5'tir. Tüm sistemin günlük sınırı `EMAIL_DAILY_LIMIT` ile ayarlanır (varsayılan 300); değer sağlayıcının kotasından düşük tutulmalıdır. Pencereler son izin verilen işlemden itibaren ölçülür, takvim gece yarısında sıfırlanmaz.

Bütün katmanların rezervasyonu tek veritabanı işlemiyle yapılır: herhangi biri reddedilirse diğer sayaçlar ilerlemez. Kesin olarak kabul edilmeyen SMTP gönderimleri günlük rezervasyonu geri bırakır, kısa süreli deneme sınırı ise kalır. DATA sonrasında sonucu belirsiz bir bağlantı kesilmesi günlük kotadan düşülmez ve otomatik tekrar gönderilmez. SMTP'nin kabul etmesi, alıcının gelen kutusuna teslim edildiği anlamına gelmez.

Gönderildi, sınır nedeniyle bastırıldı ve başarısız oldu sonuçları güvenlik kayıtlarına yazılır; e-posta içeriği, bağlantıdaki token ve SMTP parolası kaydedilmez. Ters proxy, istemcinin gönderdiği IP başlıklarını güvenilir bağlantı bilgisiyle değiştirmelidir; production proxy/IP kontrolü ayrıca yapılmalıdır.

Veritabanı eşzamanlılık ve SMTP hata kontrolü yalnızca kabul ortamında çalıştırılır. Önce kabul uygulamasını durdurun, ardından:

```sh
docker compose -f compose.acceptance.yaml stop app
docker compose -f compose.acceptance.yaml run --rm -e EMAIL_SECURITY_CHECK_ALLOWED=true fixtures npm run db:check:email-security
docker compose -f compose.acceptance.yaml up -d app
```

Kontrol, kendi geçici hız sınırı kayıtlarını temizler ve ortak sayaçların önceki değerlerini geri yükler. Gerçek kişilere e-posta göndermez. Hatırlatma gönderim işçisi bu korumalardan bağımsız olarak henüz devreye alınmamıştır; alıcı kuralı ve kalıcı tekrar önleme doğrulanmadan gerçek SMTP'ye bağlanmamalıdır.

## Olası dış maliyetler

Kod herhangi bir sağlayıcıya otomatik faturalandırma başlatmaz. Sunucu, alan adı, yedekleme alanı, SMS gönderimi ve seçilirse harici e-posta sağlayıcısı müşteri tarafından ayrıca temin edilir ve maliyetleri sağlayıcıya bağlıdır.
