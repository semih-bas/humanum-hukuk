import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, requireApiSession } from "@/lib/api-security";
import { tryWriteAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/database";
import {
  hasValidProfileImageSignature,
  isAllowedProfileImageType,
  PROFILE_IMAGE_MAX_BYTES,
} from "@/lib/profile-image";
import { readProfileImage, removeProfileImage, storeProfileImage } from "@/lib/profile-image-storage";

const MAX_MULTIPART_BYTES = PROFILE_IMAGE_MAX_BYTES + 64 * 1024;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      throw new ApiRequestError(413, "PROFILE_IMAGE_TOO_LARGE", "Profil fotoğrafı en fazla 1 MB olabilir.");
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      throw new ApiRequestError(422, "PROFILE_IMAGE_REQUIRED", "Bir profil fotoğrafı seçmelisiniz.");
    }
    if (!isAllowedProfileImageType(image.type)) {
      throw new ApiRequestError(415, "UNSUPPORTED_PROFILE_IMAGE", "Yalnızca JPG, PNG veya WEBP görseli yükleyebilirsiniz.");
    }
    if (image.size === 0 || image.size > PROFILE_IMAGE_MAX_BYTES) {
      throw new ApiRequestError(413, "PROFILE_IMAGE_TOO_LARGE", "Profil fotoğrafı en fazla 1 MB olabilir.");
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    if (!hasValidProfileImageSignature(image.type, bytes)) {
      throw new ApiRequestError(422, "INVALID_PROFILE_IMAGE", "Seçilen dosya geçerli bir görsel değil.");
    }

    await storeProfileImage(session.user.id, image.type as "image/jpeg" | "image/png" | "image/webp", bytes);
    const imageUrl = `/api/profile/image?version=${Date.now()}`;
    await prisma.user.update({ where: { id: session.user.id }, data: { image: imageUrl } });
    await tryWriteAuditLog({
      actorUserId: session.user.id,
      event: "user.profile_image_updated",
      targetType: "user",
      targetId: session.user.id,
      ipAddress: session.session.ipAddress,
    });

    return NextResponse.json({ data: { image: imageUrl } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PROFILE_IMAGE_FAILED", message: "Profil fotoğrafı kaydedilemedi." } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const image = await readProfileImage(session.user.id);
    if (!image) return new NextResponse(null, { status: 404 });
    return new NextResponse(Uint8Array.from(image.data).buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": image.type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PROFILE_IMAGE_READ_FAILED", message: "Profil fotoğrafı okunamadı." } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    await prisma.user.update({ where: { id: session.user.id }, data: { image: null } });
    await removeProfileImage(session.user.id);
    await tryWriteAuditLog({
      actorUserId: session.user.id,
      event: "user.profile_image_removed",
      targetType: "user",
      targetId: session.user.id,
      ipAddress: session.session.ipAddress,
    });
    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PROFILE_IMAGE_REMOVE_FAILED", message: "Profil fotoğrafı kaldırılamadı." } }, { status: 500 });
  }
}
