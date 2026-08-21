import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginBrand}>
        <div className={styles.brandContent}>
          <img 
            src="/images/humanum-logo.png" 
            alt="Humanum Hukuk Logo" 
            className={styles.brandLogo}
          />

          <p className={styles.brandName}>
            HUMANUM <span>HUKUK</span>
          </p>
        </div>
      </section>

      <section className={styles.loginVisual}>
        <form className={styles.loginCard}>
          <div>
            <h1>Hoş Geldiniz</h1>
            <p className={styles.loginSubtitle}>Hesabınıza giriş yapın</p>
          </div>

          <label className={styles.field}>
            Kullanıcı Adı / E-posta
            <input
              type="email"
              name="email"
              placeholder="ornek@humanumhukuk.com"
            />
          </label>

          <label className={styles.field}>
            Şifre
            <input
              type="password"
              name="password"
              placeholder="Şifrenizi girin"
            />
          </label>

          <div className={styles.loginOptions}>
            <label className={styles.rememberMe}>
              <input type="checkbox" name="rememberMe" />
              Beni Hatırla
            </label>

            <button className={styles.forgotPassword} type="button">
              Şifremi Unuttum?
            </button>
          </div>

          <button className={styles.loginButton} type="submit">
            Giriş Yap
          </button>

          <p className={styles.copyright}>
            © 2026 Humanum Hukuk - Tüm hakları saklıdır.
          </p>
        </form>
      </section>
    </main>
  );
}