// Hand-written mirrors of backend/models/erp.py — keep in sync.
export type Currency = "TRY" | "USD" | "EUR";
export type PaymentMethod = "cash" | "card" | "transfer" | "credit";
export type SaleStatus = "Hazırlanıyor" | "Kargolandı" | "Teslim Edildi" | "Tamamlandı" | "İptal";
export type ProductUnit = "KG" | "Adet" | "Paket";

export interface AdminUser { id: string; email: string; name: string }

export interface ProductIn {
  name: string; sku: string; category: string; unit: ProductUnit; vat_rate: number;
  price_b2c: number; price_b2b: number; unit_cost: number; stock: number; critical_level: number;
  track_stock: boolean; description: string;
}
export interface Product extends ProductIn { id: string; created_at: string }

export interface MaterialIn {
  kind: "green_bean" | "material"; name: string; category: string; lot_no: string; origin: string;
  variety: string; process: string; supplier_id: string | null; purchase_price: number; currency: Currency;
  unit: string; quantity: number; critical_level: number; notes: string;
}
export interface Material extends MaterialIn { id: string; created_at: string; supplier_name: string }

export interface PurchaseIn {
  quantity: number; unit_price: number; currency: Currency; date: string;
  payment: "account" | "credit"; account_id: string | null; supplier_id: string | null;
}
export interface StockAdjustIn { delta: number; reason: string }

export interface RoastInput { material_id: string; quantity: number }
export interface RoastIn { date: string; inputs: RoastInput[]; output_product_id: string; output_quantity: number; notes: string }
export interface RoastInputLine { material_id: string; name: string; quantity: number; unit: string; kind: string }
export interface Roast {
  id: string; batch_no: string; date: string; inputs: RoastInputLine[]; green_kg: number;
  output_product_id: string; output_product_name: string; output_unit: string; output_quantity: number;
  loss_pct: number; notes: string; created_at: string;
}

export interface SpecialPrice { product_id: string; price: number }
export interface ContactIn {
  type: "customer" | "supplier"; name: string; company_type: string; segment: string; contact_person: string;
  phone: string; email: string; address: string; city: string; tax_no: string; notes: string;
  favorite_beans: string; payment_term_days: number; special_prices: SpecialPrice[];
}
export interface Contact extends ContactIn {
  id: string; created_at: string; balance: number; total_sales: number; order_count: number; last_order_date: string | null;
}
export interface CariMovement {
  id: string; contact_id: string; date: string; amount: number; description: string; ref_type: string; ref_id: string | null; created_at: string;
}
export interface ContactPaymentIn { amount: number; account_id: string; date: string; note: string }

export interface SaleItemIn { product_id: string; quantity: number; unit_price: number | null }
export interface SaleIn {
  date: string; channel: "B2B" | "B2C"; customer_id: string | null; items: SaleItemIn[];
  payment_method: PaymentMethod; account_id: string | null; status: SaleStatus; notes: string;
}
export interface SaleItem {
  product_id: string; name: string; sku: string; unit: string; quantity: number; unit_price: number;
  vat_rate: number; total: number; net: number; vat: number; unit_cost: number;
}
export interface Sale {
  id: string; number: string; date: string; channel: "B2B" | "B2C"; customer_id: string | null; customer_name: string;
  items: SaleItem[]; subtotal: number; vat_total: number; total: number; cogs: number; payment_method: PaymentMethod;
  account_id: string | null; account_name: string; status: SaleStatus; notes: string; created_at: string;
}

export interface AccountIn { name: string; type: "cash" | "bank" | "pos"; currency: Currency; opening_balance: number; iban: string }
export interface Account extends AccountIn { id: string; created_at: string; balance: number; balance_try: number }
export interface Transaction {
  id: string; date: string; account_id: string; account_name: string; direction: "in" | "out"; amount: number;
  currency: Currency; amount_try: number; category: string; description: string; ref_type: string;
  ref_id: string | null; contact_id: string | null; created_at: string;
}
export interface ManualTxIn { account_id: string; direction: "in" | "out"; amount: number; date: string; category: string; description: string }
export interface TransferIn { from_account_id: string; to_account_id: string; amount: number; to_amount: number | null; date: string; note: string }

export interface ExpenseIn {
  date: string; category: string; description: string; amount: number; currency: Currency; is_fixed: boolean;
  payment: "account" | "credit"; account_id: string | null; supplier_id: string | null; document_no: string;
}
export interface Expense extends ExpenseIn {
  id: string; amount_try: number; rate: number; supplier_name: string; account_name: string; created_at: string;
}
export interface Rates { USD: number; EUR: number }

export interface SeriesPoint {
  key: string; revenue: number; cogs: number; expenses: number; profit: number;
  cash: number; card: number; transfer: number; credit: number; orders: number;
}
export interface NameAmount { name: string; amount: number }
export interface ProductMargin { product_id: string; name: string; quantity: number; revenue: number; cogs: number; margin_pct: number }
export interface ProfitReport {
  start: string; end: string; group: string; gross_sales: number; revenue_net: number; vat_total: number; cogs: number;
  gross_profit: number; opex: number; fixed_expenses: number; variable_expenses: number; purchases: number;
  net_profit: number; margin_pct: number; order_count: number; by_method: NameAmount[]; by_channel: NameAmount[];
  expenses_by_category: NameAmount[]; series: SeriesPoint[]; products: ProductMargin[];
}
export interface LowStockItem { id: string; name: string; kind: "product" | "green_bean" | "material"; quantity: number; critical_level: number; unit: string }
export interface Dashboard {
  today: string; today_sales: number; today_orders: number; today_by_method: NameAmount[]; month: ProfitReport;
  last14: SeriesPoint[]; roasted_kg_month: number; roast_count_month: number; avg_loss_pct: number;
  low_stock: LowStockItem[]; recent_roasts: Roast[]; recent_sales: Sale[]; top_customers: NameAmount[];
  receivables: number; payables: number; cash_total: number; accounts: Account[];
}
export interface TopProduct { name: string; quantity: number; total: number }
export interface MonthlyPoint { month: string; total: number }
export interface ContactDetail {
  contact: Contact; sales: Sale[]; movements: CariMovement[]; monthly: MonthlyPoint[];
  top_products: TopProduct[]; total_quantity: number; avg_order: number;
}
