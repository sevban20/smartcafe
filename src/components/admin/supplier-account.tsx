"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Phone, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TransactionForm, emptyTransaction, type TransactionFormValues } from "@/components/admin/transaction-form";
import { PayExpenseDialog, type PayableExpense } from "@/components/admin/pay-expense-dialog";
import { formatDate, formatPrice } from "@/lib/utils";

export type SupplierAccountData = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  notes: string | null;
  balance: number;
  totalSpent: number;
  totalPaid: number;
  invoices: {
    id: string;
    description: string;
    documentNo: string | null;
    category: string | null;
    amount: number;
    paidAmount: number;
    date: string;
    dueDate: string | null;
    settledAt: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string | null;
    note: string | null;
    date: string;
    description: string;
  }[];
};

export function SupplierAccount({
  supplier,
  categories,
}: {
  supplier: SupplierAccountData;
  categories: { id: string; name: string }[];
}) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [paying, setPaying] = React.useState<PayableExpense | null>(null);

  // Not: her render'da yeni nesne uretilirse TransactionForm'daki effect sonsuz donguye girer,
  // bu yuzden referans sabit tutuluyor.
  const initialExpense = React.useMemo<TransactionFormValues>(
    () => ({ ...emptyTransaction("EXPENSE"), supplierId: supplier.id, isPaid: false }),
    [supplier.id]
  );

  const supplierOptions = React.useMemo(
    () => [{ id: supplier.id, name: supplier.name }],
    [supplier.id, supplier.name]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Geri">
            <Link href="/yonetim/finans/tedarikciler">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h2 className="text-lg font-bold leading-tight">{supplier.name}</h2>
            <p className="text-xs text-muted-foreground">
              {supplier.contactName ?? "Yetkili kayıtlı değil"}
              {supplier.phone ? " · " : ""}
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3 w-3" />
                  {supplier.phone}
                </a>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Alım / Fatura Ekle
        </Button>
      </div>

      {supplier.notes && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{supplier.notes}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Güncel borç</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${supplier.balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {formatPrice(supplier.balance)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Toplam alım</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(supplier.totalSpent)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Toplam ödenen</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">{formatPrice(supplier.totalPaid)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alımlar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplier.invoices.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Bu tedarikçiden henüz alım kaydı yok.</p>
          ) : (
            <ul className="divide-y">
              {supplier.invoices.map((inv) => {
                const remaining = Math.round((inv.amount - inv.paidAmount) * 100) / 100;
                const overdue = remaining > 0.001 && inv.dueDate && new Date(inv.dueDate) < new Date();
                return (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-[11rem] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{inv.description}</p>
                        {remaining > 0.001 ? (
                          <Badge
                            variant="outline"
                            className={
                              overdue
                                ? "border-rose-200 bg-rose-100 text-rose-800"
                                : "border-amber-200 bg-amber-100 text-amber-800"
                            }
                          >
                            {inv.paidAmount > 0 ? "Kısmi" : "Açık"}
                            {inv.dueDate ? ` · vade ${formatDate(inv.dueDate)}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
                            Ödendi
                          </Badge>
                        )}
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {formatDate(inv.date)}
                        {inv.category ? ` · ${inv.category}` : ""}
                        {inv.documentNo && (
                          <>
                            {" · "}
                            <FileText className="h-3 w-3" />
                            {inv.documentNo}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatPrice(inv.amount)}</p>
                      {remaining > 0.001 && (
                        <p className="text-[11px] text-rose-700">Kalan {formatPrice(remaining)}</p>
                      )}
                    </div>

                    {remaining > 0.001 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPaying({
                            id: inv.id,
                            description: inv.description,
                            amount: inv.amount,
                            paidAmount: inv.paidAmount,
                            supplierName: supplier.name,
                          })
                        }
                      >
                        <Wallet className="h-4 w-4" />
                        Öde
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ödeme geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplier.payments.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Henüz ödeme kaydı yok.</p>
          ) : (
            <ul className="divide-y">
              {supplier.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.date)}
                      {p.method ? ` · ${p.method}` : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                    {formatPrice(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        suppliers={supplierOptions}
        initial={initialExpense}
      />
      <PayExpenseDialog expense={paying} onOpenChange={() => setPaying(null)} />
    </div>
  );
}
