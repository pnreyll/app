import type { Currency, PaymentMethod, SaleStatus } from "./types";

export const fmtMoney = (n: number, cur: Currency = "TRY") =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n || 0);

export const fmtNum = (n: number, d = 2) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: d }).format(n || 0);

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
};

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const fmtBucket = (key: string) => {
  if (key.length === 7) return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;
  return `${key.slice(8, 10)} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit", card: "Kredi Kartı", transfer: "Havale / EFT", credit: "Veresiye (Cari)",
};
export const SALE_STATUSES: SaleStatus[] = ["Hazırlanıyor", "Kargolandı", "Teslim Edildi", "Tamamlandı", "İptal"];
export const ACCOUNT_TYPES: Record<string, string> = { cash: "Nakit Kasa", bank: "Banka Hesabı", pos: "POS Hesabı" };
export const CURRENCIES: Currency[] = ["TRY", "USD", "EUR"];
export const RAW_PURCHASE_CATEGORY = "Hammadde / Tedarikçi Alımı";
export const EXPENSE_CATEGORIES = [
  "Kira", "Elektrik", "Su", "Doğalgaz", "İnternet & Telefon", "Personel Maaşı", "Personel Ek Ödeme",
  RAW_PURCHASE_CATEGORY, "Ambalaj & Kargo", "Pazarlama & Reklam", "Vergi & Harçlar", "Bakım & Onarım", "Diğer",
];
export const PRODUCT_CATEGORIES = [
  "Kavrulmuş Paket Kahve", "Kavrulmuş Dökme Kahve", "Kafe Menüsü", "Ekipman & Aksesuar", "Diğer",
];
export const VAT_RATES = [1, 10, 20];

export const opt = (values: string[]) => values.map((v) => ({ value: v, label: v }));
