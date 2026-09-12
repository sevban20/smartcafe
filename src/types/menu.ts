export type ChoiceDTO = {
  id: string;
  name: string;
  extraPrice: number;
};

export type OptionDTO = {
  id: string;
  name: string;
  isRequired: boolean;
  isMultiple: boolean;
  choices: ChoiceDTO[];
};

export type ProductDTO = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  options: OptionDTO[];
};

export type CategoryDTO = {
  id: string;
  name: string;
  products: ProductDTO[];
};

/** Sepetteki bir satirin secilen opsiyonlari (anlik kopya) */
export type SelectedOption = {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  extraPrice: number;
};

export type CartItem = {
  /** urun + secim kombinasyonundan uretilen benzersiz satir anahtari */
  lineId: string;
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  /** (basePrice + ekstralar) — tek adet fiyati */
  unitPrice: number;
};
