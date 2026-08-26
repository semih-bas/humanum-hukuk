import { prisma } from "@/lib/database";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
