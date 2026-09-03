import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { shouldRouteRealTestEmail } from "./email-test-routing";

import { releaseFailedTransactionalEmail, reserveTransactionalEmail, type TransactionalEmailCategory } from "./email-rate-limit";

type PasswordResetEmail = {
  recipientName: string;
  resetUrl: string;
  to: string;
};

type EmailVerificationEmail = {
  recipientName: string;
  verificationUrl: string;
  to: string;
};

type SmtpConfiguration = {
  from: string;
  host: string;
  password?: string;
  port: number;
  requireTls: boolean;
  secure: boolean;
  username?: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let realTestTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function realEmailTestConfiguration(): SmtpConfiguration {
  const config = parse(readFileSync(requiredEmailEnvironment("REAL_EMAIL_TEST_CONFIG")));
  if (config.SMTP_HOST !== "smtp.gmail.com" || config.SMTP_PORT !== "465" ||
      config.SMTP_SECURE !== "true" || config.SMTP_REQUIRE_TLS !== "true" ||
      !config.SMTP_USERNAME || !config.SMTP_PASSWORD || !config.SMTP_FROM) {
    throw new Error("Invalid private real email test configuration.");
  }
  return { host: config.SMTP_HOST, port: 465, secure: true, requireTls: true,
    username: config.SMTP_USERNAME, password: config.SMTP_PASSWORD, from: config.SMTP_FROM };
}

export type EmailDeliveryResult =
  | { status: "sent" }
  | { status: "suppressed"; retryAfterSeconds: number };

function requiredEmailEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required email environment variable: ${name}`);
  return value;
}

function smtpConfiguration(): SmtpConfiguration {
  const portValue = requiredEmailEnvironment("SMTP_PORT");
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  const username = process.env.SMTP_USERNAME?.trim() || undefined;
  const password = process.env.SMTP_PASSWORD?.trim() || undefined;
  if (Boolean(username) !== Boolean(password)) {
    throw new Error("SMTP_USERNAME and SMTP_PASSWORD must be configured together.");
  }

  return {
    from: requiredEmailEnvironment("SMTP_FROM"),
    host: requiredEmailEnvironment("SMTP_HOST"),
    port,
    requireTls: process.env.SMTP_REQUIRE_TLS?.trim().toLowerCase() === "true",
    secure: process.env.SMTP_SECURE?.trim().toLowerCase() === "true",
    username,
    password,
  };
}

export function validateEmailConfiguration(): void {
  smtpConfiguration();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] ?? character);
}

export function buildPasswordResetEmail({ recipientName, resetUrl }: Omit<PasswordResetEmail, "to">) {
  const safeName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: "Humanum Hukuk şifre yenileme bağlantısı",
    text: [
      `Merhaba ${recipientName},`,
      "",
      "Humanum Hukuk hesabınız için şifre yenileme talebi aldık.",
      `Şifrenizi yenilemek için bağlantıyı açın: ${resetUrl}`,
      "",
      "Bu bağlantı 30 dakika boyunca ve yalnızca bir kez kullanılabilir.",
      "Bu talebi siz oluşturmadıysanız e-postayı dikkate almayın; mevcut şifreniz değişmez.",
    ].join("\n"),
    html: `<!doctype html><html lang="tr"><body style="margin:0;background:#f3f6f8;font-family:Arial,sans-serif;color:#17283c"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border:1px solid #dce4ea;border-radius:14px;background:#fff"><tr><td style="padding:24px 28px;background:#0a2037;color:#fff"><div style="font-family:Georgia,serif;font-size:22px;letter-spacing:.14em">HUMANUM</div><div style="margin-top:5px;color:#d8ad60;font-size:11px;letter-spacing:.18em">HUKUK</div></td></tr><tr><td style="padding:30px 28px"><h1 style="margin:0 0 18px;font-size:22px">Şifrenizi yenileyin</h1><p style="margin:0 0 12px;line-height:1.6">Merhaba ${safeName},</p><p style="margin:0 0 22px;line-height:1.6;color:#52657a">Humanum Hukuk hesabınız için şifre yenileme talebi aldık.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#c89139;color:#fff;font-weight:700;text-decoration:none">Yeni şifre belirle</a></p><p style="margin:0 0 8px;color:#657587;font-size:13px;line-height:1.6">Bu bağlantı 30 dakika boyunca ve yalnızca bir kez kullanılabilir.</p><p style="margin:0;color:#8793a0;font-size:12px;line-height:1.6">Bu talebi siz oluşturmadıysanız bu e-postayı dikkate almayın; mevcut şifreniz değişmez.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export function buildEmailVerificationEmail({ recipientName, verificationUrl }: Omit<EmailVerificationEmail, "to">) {
  const safeName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(verificationUrl);
  return {
    subject: "Humanum Hukuk e-posta adresinizi doğrulayın",
    text: [
      `Merhaba ${recipientName},`,
      "",
      "Humanum Hukuk hesabınız bir yönetici tarafından oluşturuldu.",
      `E-posta adresinizi doğrulamak için bağlantıyı açın: ${verificationUrl}`,
      "",
      "Bu bağlantı 30 dakika boyunca kullanılabilir.",
      "Bu hesabı siz beklemiyorsanız bağlantıyı açmayın ve yöneticinizle iletişime geçin.",
    ].join("\n"),
    html: `<!doctype html><html lang="tr"><body style="margin:0;background:#f3f6f8;font-family:Arial,sans-serif;color:#17283c"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border:1px solid #dce4ea;border-radius:14px;background:#fff"><tr><td style="padding:24px 28px;background:#0a2037;color:#fff"><div style="font-family:Georgia,serif;font-size:22px;letter-spacing:.14em">HUMANUM</div><div style="margin-top:5px;color:#d8ad60;font-size:11px;letter-spacing:.18em">HUKUK</div></td></tr><tr><td style="padding:30px 28px"><h1 style="margin:0 0 18px;font-size:22px">E-posta adresinizi doğrulayın</h1><p style="margin:0 0 12px;line-height:1.6">Merhaba ${safeName},</p><p style="margin:0 0 22px;line-height:1.6;color:#52657a">Humanum Hukuk hesabınız bir yönetici tarafından oluşturuldu. Hesabınıza erişmeden önce e-posta adresinin size ait olduğunu doğrulayın.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#c89139;color:#fff;font-weight:700;text-decoration:none">E-posta adresimi doğrula</a></p><p style="margin:0 0 8px;color:#657587;font-size:13px;line-height:1.6">Bu bağlantı 30 dakika boyunca kullanılabilir.</p><p style="margin:0;color:#8793a0;font-size:12px;line-height:1.6">Bu hesabı siz beklemiyorsanız bağlantıyı açmayın ve yöneticinizle iletişime geçin.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

function emailTransporter(configuration: SmtpConfiguration, realTest = false) {
  let selected = realTest ? realTestTransporter : transporter;
  if (!selected) {
    selected = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      requireTLS: configuration.requireTls,
      auth: configuration.username ? { user: configuration.username, pass: configuration.password } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (realTest) realTestTransporter = selected;
    else transporter = selected;
  }
  return selected;
}

async function sendTransactionalEmail(category: TransactionalEmailCategory, input: { to: string }, content: { subject: string; text: string; html: string }): Promise<EmailDeliveryResult> {
  const realTest = shouldRouteRealTestEmail(input.to);
  const configuration = realTest ? realEmailTestConfiguration() : smtpConfiguration();
  const reservation = await reserveTransactionalEmail(category, input.to);
  if (!reservation.allowed) return { status: "suppressed", retryAfterSeconds: reservation.retryAfterSeconds };

  try {
    await emailTransporter(configuration, realTest).sendMail({
      from: configuration.from,
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return { status: "sent" };
  } catch (error) {
    if (isDefiniteEmailRejection(error)) {
      await releaseFailedTransactionalEmail(reservation.releaseOnFailureKeys ?? []).catch((releaseError: unknown) => {
        console.error("Failed to release unsuccessful email quota reservation", {
          error: releaseError instanceof Error ? releaseError.name : "UnknownError",
        });
      });
    }
    throw error;
  }
}

export function isDefiniteEmailRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const smtpError = error as { code?: string; command?: string; responseCode?: number };
  // A timeout after DATA may mean the provider accepted the message. Keep its
  // quota reservation instead of treating an ambiguous delivery as unsent.
  return ["EDNS", "ECONNECTION", "EAUTH", "EENVELOPE"].includes(smtpError.code ?? "") ||
    ["CONN", "EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO"].includes(smtpError.command ?? "") ||
    (typeof smtpError.responseCode === "number" && smtpError.responseCode >= 400 && smtpError.responseCode < 600);
}

export async function sendPasswordResetEmail(input: PasswordResetEmail): Promise<EmailDeliveryResult> {
  return sendTransactionalEmail("password-reset", input, buildPasswordResetEmail(input));
}

export async function sendEmailVerificationEmail(input: EmailVerificationEmail): Promise<EmailDeliveryResult> {
  return sendTransactionalEmail("verification", input, buildEmailVerificationEmail(input));
}

export type ReminderEmail = {
  to: string;
  recipientName: string;
  reminderId: string;
  title: string;
  referenceNumber: string;
  dueAt: Date;
};

export function buildReminderEmail(input: ReminderEmail) {
  const origin = new URL(requiredEmailEnvironment("BETTER_AUTH_URL"));
  if (!["http:", "https:"].includes(origin.protocol)) throw new Error("Invalid application URL");
  const link = new URL(`/hatirlatmalar?reminder=${encodeURIComponent(input.reminderId)}#reminder-${encodeURIComponent(input.reminderId)}`, origin).href;
  const date = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" }).format(input.dueAt);
  return {
    subject: "Humanum Hukuk — Dosya hatırlatması",
    text: `Merhaba ${input.recipientName},\n\n${input.title}\nDosya: ${input.referenceNumber}\nTarih: ${date}\n\nHatırlatmayı görüntüleyin: ${link}\n\nBu bildirim yalnızca aktif ve e-postası doğrulanmış yöneticilere gönderilir.`,
    html: `<!doctype html>
<html lang="tr"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f6f8;font-family:Arial,sans-serif;color:#17283c">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;table-layout:fixed;border:1px solid #dce4ea;border-radius:14px;background:#ffffff">
  <tr><td style="padding:22px 24px;background:#0a2037;border-radius:13px 13px 0 0">
    <p style="margin:0;color:#ffffff;font-family:Georgia,serif;font-size:22px;line-height:28px;letter-spacing:3px">HUMANUM</p>
    <p style="margin:4px 0 0;color:#d8ad60;font-size:11px;line-height:16px;letter-spacing:4px">HUKUK</p>
  </td></tr>
  <tr><td style="padding:24px;word-break:break-word;overflow-wrap:anywhere">
    <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#17283c">Dosya hatırlatması</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#52657a">Merhaba ${escapeHtml(input.recipientName)},</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;background:#f6f8fa;border:1px solid #e5ebf0;border-radius:8px"><tr><td style="padding:16px;border-left:3px solid #c89139;word-break:break-word;overflow-wrap:anywhere">
      <p style="margin:0 0 14px;font-size:15px;line-height:23px;font-weight:700;color:#17283c">${escapeHtml(input.title)}</p>
      <p style="margin:0 0 4px;font-size:13px;line-height:21px;color:#52657a"><strong style="color:#17283c">Dosya:</strong> ${escapeHtml(input.referenceNumber)}</p>
      <p style="margin:0;font-size:13px;line-height:21px;color:#52657a"><strong style="color:#17283c">Tarih:</strong> ${escapeHtml(date)}</p>
    </td></tr></table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:22px 0 0">
      <a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 20px;background:#c89139;border:1px solid #c89139;color:#ffffff;border-radius:8px;font-size:14px;line-height:20px;font-weight:700;text-decoration:none">Hatırlatmayı görüntüle</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e5ebf0;background:#fafbfc;border-radius:0 0 13px 13px">
    <p style="margin:0;color:#657587;font-size:12px;line-height:19px">Bu bildirim yalnızca aktif ve e-postası doğrulanmış yöneticilere gönderilir.</p>
  </td></tr>
</table></td></tr></table>
</body></html>`,
  };
}

export async function sendReminderEmail(input: ReminderEmail): Promise<EmailDeliveryResult> {
  return sendTransactionalEmail("reminder", input, buildReminderEmail(input));
}
