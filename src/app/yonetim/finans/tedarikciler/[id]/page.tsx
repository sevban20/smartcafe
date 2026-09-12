import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SupplierAccount, type SupplierAccountData } from "@/components/admin/supplier-account";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cari Hesap" };

type Invoice = {
  id: string;
  description: string;
  documentNo: string | null;
  category: string | null;
  amount: number;
  paidAmount: number;
  date: Date;
  dueDate: Date | null;
  settledAt: Date | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  note: string | null;
  date: Date;
  transaction: { description: string } | null;
};

export default async function CariHesapPage({ params }: { params: { id: string } }) {
  const [supplier, categories] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: params.id },
      include: {
        transactions: {
          where: { type: "EXPENSE" },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            description: true,
            documentNo: true,
            category: true,
            amount: true,
            paidAmount: true,
            date: true,
            dueDate: true,
            settledAt: true,
          },
        },
        payments: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            amount: true,
            method: true,
            note: true,
            date: true,
            transaction: { select: { description: true } },
          },
        },
      },
    }),
    prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  if (!supplier) notFound();

  const invoices = supplier.transactions as Invoice[];
  const payments = supplier.payments as Payment[];

  const totalSpent = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.paidAmount, 0);

  const data: SupplierAccountData = {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    notes: supplier.notes,
    balance: Math.round((totalSpent - totalPaid) * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    invoices: invoices.map((i) => ({
      id: i.id,
      description: i.description,
      documentNo: i.documentNo,
      category: i.category,
      amount: i.amount,
      paidAmount: i.paidAmount,
      date: i.date.toISOString(),
      dueDate: i.dueDate ? i.dueDate.toISOString() : null,
      settledAt: i.settledAt ? i.settledAt.toISOString() : null,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      note: p.note,
      date: p.date.toISOString(),
      description: p.transaction?.description ?? "Ödeme",
    })),
  };

  return <SupplierAccount supplier={data} categories={categories} />;
}
