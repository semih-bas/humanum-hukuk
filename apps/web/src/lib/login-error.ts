export type LoginErrorNotice = {
  kind: "error" | "info";
  message: string;
};

export function getLoginErrorNotice(error: { code?: string | null; status?: number }): LoginErrorNotice {
  if (error.code === "BANNED_USER") {
    return {
      kind: "error",
      message: "Hesabınız yönetici tarafından pasifleştirildi. Yeniden erişim için yöneticinizle iletişime geçin.",
    };
  }

  if (error.code === "EMAIL_NOT_VERIFIED") {
    return {
      kind: "info",
      message: "E-posta adresiniz henüz doğrulanmadı. Yeni doğrulama bağlantısı e-posta adresinize gönderildi.",
    };
  }

  if (error.status === 429) {
    return {
      kind: "error",
      message: "Çok fazla giriş denemesi yapıldı. Lütfen kısa bir süre sonra tekrar deneyin.",
    };
  }

  return {
    kind: "error",
    message: "E-posta adresi veya şifre hatalı.",
  };
}
