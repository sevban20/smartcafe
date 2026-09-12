"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionForm, emptyTransaction, type TransactionFormValues } from "@/components/admin/transaction-form";
import { PayExpenseDialog, type PayableExpense } from "@/components/admin/pay-expense-dialog";
import { deleteTransaction } from "@/app/yonetim/finans/actions";
import { formatDate, formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export type TransactionRow = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  paidAmount: number;
  description: string;
  category: string | null;
  documentNo: string | null;
  supplierId: string | null;
  supplierName: string | null;
  date: string;
  dueDate: string | null;
  settledAt: string | null;
  isAutomatic: boolean;
};

type Filter = "ALL" | "INCOME" | "EXPENSE" | "DEBT";

export function TransactionsPanel({
  transactions,
  categories,
  suppliers,
}: {
  transactions: TransactionRow[];
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TransactionFormValues | null>(null);
  const [paying, setPaying] = React.useState<PayableExpense | null>(null);
  const [filter, setFilter] = React.useState<Filter>("ALL");

  const visible = transactions.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "DEBT") return t.type === "EXPENSE" && t.paidAmount < t.amount;
    return t.type === filter;
  });

  const openNew = (type: "INCOME" | "EXPENSE") => {
    setEditing(emptyTransaction(type));
    setFormOpen(true);
  };

  const openEdit = (row: TransactionRow) => {
    setEditing({
      id: row.id,
      type: row.type,
      amount: String(row.amount),
      description: row.description,
      category: row.category ?? "",
      documentNo: row.documentNo ?? "",
      supplierId: row.supplierId ?? "none",
      date: row.date.slice(0, 10),
      isPaid: row.paidAmount >= row.amount,
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : "",
    });
    setFormOpen(true);
  };

  const remove = async (row: TransactionRow) => {
    if (!window.confirm("Bu kayıt silinsin mi?")) return;
    const res = await deleteTransaction(row.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kayıt silindi");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="ALL">Tümü</TabsTrigger>
            <TabsTrigger value="INCOME">Gelir</TabsTrigger>
            <TabsTrigger value="EXPENSE">Gider</TabsTrigger>
            <TabsTrigger value="DEBT">Borçlar</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button onClick={() => openNew("EXPENSE")}>
            <Plus className="h-4 w-4" />
            Gider Ekle
          </Button>
          <Button variant="outline" onClick={() => openNew("INCOME")}>
            <Plus className="h-4 w-4" />
            Gelir
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {filter === "DEBT" ? "Ödenmemiş borç yok." : "Bu filtrede kayıt yok."}
        </Card>
      ) : (
        <Card className="divide-y">
          {visible.map((t) => {
            const remaining = Math.round((t.amount - t.paidAmount) * 100) / 100;
            const isDebt = t.type === "EXPENSE" && remaining > 0.001;
            const overdue = isDebt && t.dueDate && new Date(t.dueDate) < new Date();

            return (
              <div key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{t.description}</p>
                    {t.isAutomatic && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Lock className="h-2.5 w-2.5" />
                        Otomatik
                      </Badge>
                    )}
                    {isDebt && (
                      <Badge
                        variant="outline"
                        className={
                          overdue
                            ? "gap-1 border-rose-200 bg-rose-100 text-rose-800"
                            : "gap-1 border-amber-200 bg-amber-100 text-amber-800"
                        }
                      >
                        {overdue && <AlertCircle className="h-2.5 w-2.5" />}
                        {t.paidAmount > 0 ? "Kısmi ödendi" : "Borç"}
                        {t.dueDate ? ` · ${formatDate(t.dueDate)}` : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.date)}
                    {t.category ? ` · ${t.category}` : ""}
                    {t.supplierName ? ` · ${t.supplierName}` : ""}
                    {t.documentNo ? ` · ${t.documentNo}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      t.type === "INCOME" ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {t.type === "INCOME" ? "+" : "−"}
                    {formatPrice(t.amount)}
                  </span>
                  {isDebt && (
                    <p className="text-[11px] text-muted-foreground">Kalan {formatPrice(remaining)}</p>
                  )}
                </div>

                <div className="flex gap-1">
                  {isDebt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPaying({
                          id: t.id,
                          description: t.description,
                          amount: t.amount,
                          paidAmount: t.paidAmount,
                          supplierName: t.supplierName,
                        })
                      }
                    >
                      <Wallet className="h-4 w-4" />
                      Öde
                    </Button>
                  )}
                  {!t.isAutomatic && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Düzenle">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(t)} aria-label="Sil">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        suppliers={suppliers}
        initial={editing}
      />
      <PayExpenseDialog expense={paying} onOpenChange={() => setPaying(null)} />
    </div>
  );
}
