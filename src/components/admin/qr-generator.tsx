"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function QrGenerator() {
  const [tableCount, setTableCount] = React.useState(10);
  const [baseUrl, setBaseUrl] = React.useState("");
  const [codes, setCodes] = React.useState<{ tableNo: number; dataUrl: string; url: string }[]>([]);

  React.useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  React.useEffect(() => {
    if (!baseUrl) return;
    let cancelled = false;
    const build = async () => {
      const list: { tableNo: number; dataUrl: string; url: string }[] = [];
      for (let i = 1; i <= Math.min(Math.max(tableCount, 1), 60); i++) {
        const url = `${baseUrl}/menu/${i}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 512,
          margin: 1,
          color: { dark: "#3b2411", light: "#ffffff" },
        });
        list.push({ tableNo: i, dataUrl, url });
      }
      if (!cancelled) setCodes(list);
    };
    build();
    return () => {
      cancelled = true;
    };
  }, [tableCount, baseUrl]);

  const download = (tableNo: number, dataUrl: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `masa-${tableNo}-qr.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="text-xl font-bold">QR Kodlar</h1>
        <p className="text-sm text-muted-foreground">
          Her masa için QR kod üretin, yazdırıp masalara yerleştirin.
        </p>
      </div>

      <Card className="space-y-3 p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="masa-sayisi">Masa sayısı</Label>
            <Input
              id="masa-sayisi"
              type="number"
              min={1}
              max={60}
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-adresi">Site adresi</Label>
            <Input
              id="site-adresi"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value.replace(/\/$/, ""))}
              placeholder="https://kafem.vercel.app"
            />
            <p className="text-[11px] text-muted-foreground">
              Yayına aldıktan sonra buraya gerçek adresinizi yazın, QR kodlar ona göre üretilir.
            </p>
          </div>
        </div>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="h-4 w-4" />
          Tümünü Yazdır
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {codes.map((c) => (
          <Card key={c.tableNo} className="flex flex-col items-center gap-2 p-3 print:break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.dataUrl} alt={`Masa ${c.tableNo} QR kodu`} className="w-full rounded-lg" />
            <p className="text-sm font-bold">Masa {c.tableNo}</p>
            <Button
              variant="ghost"
              size="sm"
              className="print:hidden"
              onClick={() => download(c.tableNo, c.dataUrl)}
            >
              <Download className="h-4 w-4" />
              İndir
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
