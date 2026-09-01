import { Prisma } from "@/generated/prisma/client";
import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { createCaseFile } from "@/lib/cases/create-case";
import { createCaseSchema } from "@/lib/cases/create-case-input";
import { listCaseFiles } from "@/lib/cases/list-cases";
import { NextResponse } from "next/server";
import { z } from "zod";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const listQuerySchema = z.object({
  query: z.string().trim().max(200).refine((value) => !CONTROL_CHARACTER_PATTERN.test(value)).default(""),
  status: z.enum(["ALL", "OPEN", "ENFORCEMENT", "INSTALLMENT", "PENDING", "CLOSED"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().refine((value) => [5, 10, 20].includes(value)).default(10),
  sortBy: z.enum(["createdAt", "licenseHolder", "vehiclePlate", "accidentDate", "debtorName", "enforcementOffice", "status"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export async function GET(request: Request) {
  try {
    await requireApiSession(request);
    const url = new URL(request.url);
    const validation = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

    if (!validation.success) {
      return jsonResponse({
        error: {
          code: "INVALID_QUERY",
          message: "Listeleme parametreleri geçerli değil.",
        },
      }, 400);
    }

    const result = await listCaseFiles(validation.data);
    return jsonResponse({ data: result }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    }

    console.error("Failed to list case files", {
      error: error instanceof Error ? error.name : "UnknownError",
    });

    return jsonResponse({
      error: {
        code: "INTERNAL_ERROR",
        message: "Dosyalar listelenirken beklenmeyen bir hata oluştu.",
      },
    }, 500);
  }
}

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
