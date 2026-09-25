import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ApiRequestError, assertSameOrigin, readJsonBody } from "@/lib/api-security";
import { prisma } from "@/lib/database";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.banned || session.user.role !== "admin") {
      throw new ApiRequestError(403, "ADMIN_REQUIRED", "Bu işlem yalnızca yöneticilere açıktır.");
    }

    const body = await readJsonBody(request) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) throw new ApiRequestError(400, "INVALID_EMAIL", "E-posta adresi geçerli olmalıdır.");

    const target = await prisma.user.findUnique({
      where: { email },
      select: { email: true, emailVerified: true, banned: true, deletionRequestedAt: true },
    });
    if (!target) throw new ApiRequestError(404, "USER_NOT_FOUND", "Kullanıcı bulunamadı.");
    if (target.emailVerified) throw new ApiRequestError(409, "EMAIL_ALREADY_VERIFIED", "E-posta adresi zaten doğrulanmış.");
    if (target.banned || target.deletionRequestedAt) {
      throw new ApiRequestError(409, "USER_INACTIVE", "Pasif kullanıcıya doğrulama e-postası gönderilemez.");
    }

    // Yönetici oturumunu Better Auth çağrısına taşımıyoruz. Standart uç nokta,
    // oturumdaki yönetici e-postasıyla hedef e-posta farklıysa EMAIL_MISMATCH verir.
    await auth.api.sendVerificationEmail({
      body: { email: target.email, callbackURL: "/sifremi-unuttum" },
    });

    return NextResponse.json({ data: { email: target.email } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "VERIFICATION_SEND_FAILED", message: "Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin." } }, { status: 500 });
  }
}
