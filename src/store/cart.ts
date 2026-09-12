"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, SelectedOption } from "@/types/menu";
import { buildLineId, calcUnitPrice } from "@/lib/pricing";

type AddArgs = {
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
};

type CartState = {
  tableNo: string | null;
  items: CartItem[];
  note: string;
  setTableNo: (t: string) => void;
  setNote: (n: string) => void;
  addItem: (args: AddArgs) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      tableNo: null,
      items: [],
      note: "",
      setTableNo: (tableNo) =>
        set((state) => (state.tableNo === tableNo ? state : { ...state, tableNo, items: [], note: "" })),
      setNote: (note) => set({ note }),
      addItem: ({ productId, productName, basePrice, quantity, selectedOptions }) =>
        set((state) => {
          const lineId = buildLineId(productId, selectedOptions);
          const unitPrice = calcUnitPrice(basePrice, selectedOptions);
          const existing = state.items.find((i) => i.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === lineId ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          const item: CartItem = {
            lineId,
            productId,
            productName,
            basePrice,
            quantity,
            selectedOptions,
            unitPrice,
          };
          return { items: [...state.items, item] };
        }),
      increment: (lineId) =>
        set((state) => ({
          items: state.items.map((i) => (i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i)),
        })),
      decrement: (lineId) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.lineId === lineId ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0),
        })),
      removeItem: (lineId) => set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),
      clear: () => set({ items: [], note: "" }),
    }),
    { name: "smartcafe-cart" }
  )
);

export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

export const cartCount = (items: CartItem[]) => items.reduce((sum, i) => sum + i.quantity, 0);
