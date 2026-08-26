import { Prisma } from "@/generated/prisma/client";
import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { createCaseFile } from "@/lib/cases/create-case";
import { createCaseSchema } from "@/lib/cases/create-case-input";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const body = await readJsonBody(request);
    const validation = createCaseSchema.safeParse(body);

    if (!validation.success) {
      return jsonResponse({
        error: {
          code: "VALIDATION_ERROR",
          message: "Gönderilen dosya bilgileri geçerli değil.",
          fields: validation.error.flatten().fieldErrors,
        },
      }, 400);
    }

    const createdCase = await createCaseFile(validation.data, session.user.id);

    return jsonResponse({ data: createdCase }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonResponse({
        error: {
          code: "CASE_CONFLICT",
          message: "Aynı icra dairesi ve dosya numarasıyla kayıtlı bir dosya zaten bulunuyor.",
        },
      }, 409);
    }

    console.error("Failed to create case file", {
      error: error instanceof Error ? error.name : "UnknownError",
    });

    return jsonResponse({
      error: {
        code: "INTERNAL_ERROR",
        message: "Dosya oluşturulurken beklenmeyen bir hata oluştu.",
      },
    }, 500);
  }
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
