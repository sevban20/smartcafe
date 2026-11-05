"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookUser, Check, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CariCustomer = {
  id: string;
  name: string;
  phone: string | null;
  creditLimit: number | null;
  balance: number;
};

type Props = {
  /** Masanin kapatilacak toplam tutari */
  total: number;
  pending: boolean;
  onConfirm: (customerId: string) => void;
};

/**
 * Hesap kapatma dialogunda "Cariye Yaz" bolumu: musteri sec, borca yaz.
 * Limit asacak musteriler secilebilir ama onay dugmesi kapanir (sunucu da reddeder).
 */
export function CariPicker({ total, pending, onConfirm }: Props) {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cari-musteriler"],
    queryFn: async () => {
      const res = await fetch("/api/cari", { cache: "no-store" });
      if (!res.ok) throw new Error("Cari müşteriler alınamadı");
      return (await res.json()) as { customers: CariCustomer[]; canCreate: boolean };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, phone: newPhone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Müşteri eklenemedi");
      return json.customer as CariCustomer;
    },
    onSuccess: (customer) => {
      queryClient.setQueryData<{ customers: CariCustomer[]; canCreate: boolean }>(["cari-musteriler"], (old) =>
        old
          ? {
              ...old,
              customers: [...old.customers, customer].sort((a, b) => a.name.localeCompare(b.name, "tr")),
            }
          : old
      );
      setSelectedId(customer.id);
      setAdding(false);
      setNewName("");
      setNewPhone("");
      setQuery("");
      toast.success(`${customer.name} cari müşteri olarak eklendi`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Müşteri eklenemedi"),
  });

  const customers = data?.customers ?? [];
  const q = query.trim().toLocaleLowerCase("tr");
  const filtered = q
    ? customers.filter(
        (c) => c.name.toLocaleLowerCase("tr").includes(q) || (c.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      )
    : customers;

  const selected = customers.find((c) => c.id === selectedId) ?? null;
  const overLimit =
    selected && selected.creditLimit != null && selected.balance + total > selected.creditLimit + 0.001;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BookUser className="h-4 w-4" />
          Cari müşteri seçin
        </p>
        {data?.canCreate && !adding && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setAdding(true);
              setNewName(query.trim());
            }}
          >
            <Plus className="h-3 w-3" />
            Yeni müşteri
          </button>
        )}
      </div>

      {adding ? (
        <div className="space-y-2">
          <Input placeholder="Ad soyad / firma" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <Input
            placeholder="Telefon (isteğe bağlı)"
            type="tel"
            inputMode="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setAdding(false)}>
              Vazgeç
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={create.isPending || !newName.trim()}
              onClick={() => create.mutate()}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ekle ve seç"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {customers.length > 5 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="İsim ya da telefon ara"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}

          <div className="max-h-44 space-y-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {customers.length === 0
                  ? data?.canCreate
                    ? "Henüz cari müşteri yok. “Yeni müşteri” ile ekleyin."
                    : "Henüz cari müşteri yok. Yöneticiden eklemesini isteyin."
                  : "Eşleşen müşteri yok."}
              </p>
            ) : (
              filtered.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left",
                      isSel ? "border-primary ring-1 ring-primary" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {isSel && <Check className="h-3.5 w-3.5 text-primary" />}
                        <span className="truncate">{c.name}</span>
                      </span>
                      {c.phone && <span className="block text-[11px] text-muted-foreground">{c.phone}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-xs font-semibold tabular-nums",
                          c.balance > 0 ? "text-rose-700" : "text-muted-foreground"
                        )}
                      >
                        {c.balance > 0 ? `Borç ${formatPrice(c.balance)}` : "Borcu yok"}
                      </span>
                      {c.creditLimit != null && (
                        <span className="block text-[10px] text-muted-foreground">
                          Limit {formatPrice(c.creditLimit)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {selected && !adding && (
        <>
          {overLimit ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-900">
              Borç limiti aşılıyor: mevcut {formatPrice(selected.balance)} + bu hesap {formatPrice(total)} &gt; limit{" "}
              {formatPrice(selected.creditLimit ?? 0)}. Önce tahsilat alınmalı ya da limit yükseltilmeli.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Yeni borç: <span className="font-semibold text-foreground">{formatPrice(selected.balance + total)}</span>
            </p>
          )}
          <Button className="w-full" disabled={pending || !!overLimit} onClick={() => onConfirm(selected.id)}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookUser className="h-4 w-4" />}
            {selected.name} hesabına yaz · {formatPrice(total)}
          </Button>
        </>
      )}
    </div>
  );
}
