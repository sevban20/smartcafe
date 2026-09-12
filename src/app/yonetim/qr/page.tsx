import { QrGenerator } from "@/components/admin/qr-generator";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "QR Kodlar" };

export default function QrPage() {
  return <QrGenerator />;
}
