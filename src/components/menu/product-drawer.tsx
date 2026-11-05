"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { calcUnitPrice } from "@/lib/pricing";
import { useCart } from "@/store/cart";
import type { ProductDTO, SelectedOption } from "@/types/menu";
import { toast } from "sonner";

type Props = {
  product: ProductDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductDrawer({ product, open, onOpenChange }: Props) {
  const addItem = useCart((s) => s.addItem);
  const [quantity, setQuantity] = React.useState(1);
  /** optionId -> secili choiceId listesi */
  const [selection, setSelection] = React.useState<Record<string, string[]>>({});

  // Urun degistiginde secimleri sifirla, zorunlu tek secimlilerde ilk secenegi on-isaretle
  React.useEffect(() => {
    if (!product) return;
    const initial: Record<string, string[]> = {};
    for (const option of product.options) {
      if (option.isRequired && !option.isMultiple && option.choices[0]) {
        initial[option.id] = [option.choices[0].id];
      } else {
        initial[option.id] = [];
      }
    }
    setSelection(initial);
    setQuantity(1);
  }, [product]);

  const selectedOptions: SelectedOption[] = React.useMemo(() => {
    if (!product) return [];
    const list: SelectedOption[] = [];
    for (const option of product.options) {
      for (const choiceId of selection[option.id] ?? []) {
        const choice = option.choices.find((c) => c.id === choiceId);
        if (choice) {
          list.push({
            optionId: option.id,
            optionName: option.name,
            choiceId: choice.id,
            choiceName: choice.name,
            extraPrice: choice.extraPrice,
          });
        }
      }
    }
    return list;
  }, [product, selection]);

  if (!product) return null;

  const unitPrice = calcUnitPrice(product.price, selectedOptions);
  const missing = product.options.filter(
    (o) => o.isRequired && (selection[o.id]?.length ?? 0) === 0
  );

  const toggleSingle = (optionId: string, choiceId: string) =>
    setSelection((prev) => ({ ...prev, [optionId]: [choiceId] }));

  const toggleMultiple = (optionId: string, choiceId: string, checked: boolean) =>
    setSelection((prev) => {
      const current = prev[optionId] ?? [];
      return {
        ...prev,
        [optionId]: checked ? [...current, choiceId] : current.filter((id) => id !== choiceId),
      };
    });

  const handleAdd = () => {
    if (missing.length > 0) {
      toast.error(`"${missing[0].name}" seçimi zorunlu.`);
      return;
    }
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      quantity,
      selectedOptions,
    });
    toast.success(`${quantity}x ${product.name} sepete eklendi`);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {/* Gorsel + baslik + secenekler tek kaydirilabilir alanda: uzun secenek
            listelerinde fotograf ekrani yiyip secenekleri sikistirmasin */}
        <div className="flex-1 overflow-y-auto">
          {product.imageUrl && (
            <div className="px-4 pt-3">
              {/* Fotograf hic kirpilmadan (object-contain) gosterilir; kenarlarda kalan
                  bosluk ayni fotografin bulanik kopyasiyla doldurulur. Eskiden tam
                  genislik x 160px object-cover idi: kare/dikey fotograflar ince bir
                  serit halinde kirpilip asiri buyutuluyordu. */}
              <div className="relative aspect-[4/3] max-h-[45vh] w-full overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  decoding="async"
                  className="relative h-full w-full object-contain"
                />
              </div>
            </div>
          )}

          <DrawerHeader>
            <DrawerTitle>{product.name}</DrawerTitle>
            {product.description ? <DrawerDescription>{product.description}</DrawerDescription> : null}
            <p className="pt-1 text-sm font-medium text-muted-foreground">
              Başlangıç fiyatı {formatPrice(product.price)}
            </p>
          </DrawerHeader>

          <div className="space-y-5 px-4 pb-4">
            {product.options.map((option) => (
              <div key={option.id} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{option.name}</h3>
                  {option.isRequired ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Zorunlu
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      İsteğe bağlı
                    </Badge>
                  )}
                  {option.isMultiple ? (
                    <span className="text-[11px] text-muted-foreground">Birden fazla seçilebilir</span>
                  ) : null}
                </div>

                {option.isMultiple ? (
                  <div className="space-y-1">
                    {option.choices.map((choice) => {
                      const checked = (selection[option.id] ?? []).includes(choice.id);
                      return (
                        <label
                          key={choice.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40"
                        >
                          <span className="flex items-center gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleMultiple(option.id, choice.id, v === true)}
                            />
                            <span className="text-sm">{choice.name}</span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {choice.extraPrice > 0 ? `+${formatPrice(choice.extraPrice)}` : "Ücretsiz"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <RadioGroup
                    value={(selection[option.id] ?? [])[0] ?? ""}
                    onValueChange={(v) => toggleSingle(option.id, v)}
                    className="space-y-1"
                  >
                    {option.choices.map((choice) => (
                      <label
                        key={choice.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[[data-state=checked]]:border-primary"
                      >
                        <span className="flex items-center gap-3">
                          <RadioGroupItem value={choice.id} id={choice.id} />
                          <Label htmlFor={choice.id} className="cursor-pointer text-sm font-normal">
                            {choice.name}
                          </Label>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {choice.extraPrice > 0 ? `+${formatPrice(choice.extraPrice)}` : "Ücretsiz"}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
                <Separator />
              </div>
            ))}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Adet</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Azalt"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                  aria-label="Artır"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter className="safe-bottom">
          <Button size="lg" className="w-full justify-between" onClick={handleAdd}>
            <span>Sepete Ekle</span>
            <span className="tabular-nums">{formatPrice(unitPrice * quantity)}</span>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
