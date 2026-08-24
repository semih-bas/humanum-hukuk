import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humanum Hukuk",
  description: "Humanum Hukuk güvenli dosya ve belge yönetim sistemi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="tr"><body>{children}</body></html>;
}
