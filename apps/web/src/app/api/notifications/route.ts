import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { listAdminNotifications } from "@/lib/admin-notifications";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);

    if (session.user.role !== "admin") {
      throw new ApiRequestError(403, "FORBIDDEN", "Bildirimleri yalnızca yöneticiler görüntüleyebilir.");
    }

    const notifications = await listAdminNotifications();
    return jsonResponse({ data: notifications }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    }

    console.error("Failed to list admin notifications", {
      error: error instanceof Error ? error.name : "UnknownError",
    });

    return jsonResponse({
      error: {
        code: "INTERNAL_ERROR",
        message: "Bildirimler yüklenirken beklenmeyen bir hata oluştu.",
      },
    }, 500);
  }
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
