import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Uptime izleme servisleri (UptimeRobot, Better Uptime vb.) veya Docker
 * healthcheck icin. Giris gerektirmez, veritabani baglantisini da dener.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (error) {
    console.error("Health check: veritabanina baglanilamadi:", error);
    return NextResponse.json({ status: "error", db: "error" }, { status: 503 });
  }
}
