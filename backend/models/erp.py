"""All Pydantic v2 models for Chrono Coffee House ERP. Mirrored by frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Currency = Literal["TRY", "USD", "EUR"]
PaymentMethod = Literal["cash", "card", "transfer", "credit"]
SaleStatus = Literal["Hazırlanıyor", "Kargolandı", "Teslim Edildi", "Tamamlandı", "İptal"]
RAW_PURCHASE_CATEGORY = "Hammadde / Tedarikçi Alımı"


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Auth ----------
class LoginIn(BaseModel):
    email: str
    password: str


class AdminUser(BaseModel):
    id: str
    email: str
    name: str


# ---------- Products ----------
class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    category: str
    unit: Literal["KG", "Adet", "Paket"] = "Paket"
    vat_rate: float = Field(default=10, ge=0)
    price_b2c: float = Field(ge=0)
    price_b2b: float = Field(ge=0)
    unit_cost: float = Field(default=0, ge=0)
    stock: float = 0
    critical_level: float = 0
    track_stock: bool = True
    description: str = ""


class Product(ProductIn):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=now_utc)


class StockAdjustIn(BaseModel):
    delta: float
    reason: str = ""


# ---------- Materials (green beans + packaging/consumables) ----------
class MaterialIn(BaseModel):
    kind: Literal["green_bean", "material"]
    name: str = Field(min_length=1)
    category: str = ""
    lot_no: str = ""
    origin: str = ""
    variety: str = ""
    process: str = ""
    supplier_id: Optional[str] = None
    purchase_price: float = Field(default=0, ge=0)
    currency: Currency = "TRY"
    unit: str = "KG"
    quantity: float = 0
    critical_level: float = 0
    notes: str = ""


class Material(MaterialIn):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=now_utc)


class MaterialOut(Material):
    supplier_name: str = ""


class PurchaseIn(BaseModel):
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    currency: Currency = "TRY"
    date: str
    payment: Literal["account", "credit"] = "account"
    account_id: Optional[str] = None
    supplier_id: Optional[str] = None


# ---------- Roasting ----------
class RoastInput(BaseModel):
    material_id: str
    quantity: float = Field(gt=0)


class RoastIn(BaseModel):
    date: str
    inputs: List[RoastInput] = Field(min_length=1)
    output_product_id: str
    output_quantity: float = Field(gt=0)
    notes: str = ""


class RoastInputLine(BaseModel):
    material_id: str
    name: str
    quantity: float
    unit: str
    kind: str


class Roast(BaseModel):
    id: str = Field(default_factory=new_id)
    batch_no: str
    date: str
    inputs: List[RoastInputLine]
    green_kg: float
    output_product_id: str
    output_product_name: str
    output_unit: str
    output_quantity: float
    loss_pct: float
    notes: str = ""
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Contacts (CRM + Cari) ----------
class SpecialPrice(BaseModel):
    product_id: str
    price: float = Field(ge=0)


class ContactIn(BaseModel):
    type: Literal["customer", "supplier"]
    name: str = Field(min_length=1)
    company_type: str = ""
    segment: str = ""
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    tax_no: str = ""
    notes: str = ""
    favorite_beans: str = ""
    payment_term_days: int = 0
    special_prices: List[SpecialPrice] = []


class Contact(ContactIn):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=now_utc)


class ContactOut(Contact):
    balance: float = 0
    total_sales: float = 0
    order_count: int = 0
    last_order_date: Optional[str] = None


class CariMovement(BaseModel):
    id: str = Field(default_factory=new_id)
    contact_id: str
    date: str
    amount: float  # + => contact owes us (alacak), - => we owe contact (borç)
    description: str
    ref_type: str
    ref_id: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)


class ContactPaymentIn(BaseModel):
    amount: float = Field(gt=0)
    account_id: str
    date: str
    note: str = ""


# ---------- Sales ----------
class SaleItemIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)


class SaleIn(BaseModel):
    date: str
    channel: Literal["B2B", "B2C"]
    customer_id: Optional[str] = None
    items: List[SaleItemIn] = Field(min_length=1)
    payment_method: PaymentMethod
    account_id: Optional[str] = None
    status: SaleStatus = "Tamamlandı"
    notes: str = ""


class SaleItem(BaseModel):
    product_id: str
    name: str
    sku: str
    unit: str
    quantity: float
    unit_price: float  # KDV dahil
    vat_rate: float
    total: float
    net: float
    vat: float
    unit_cost: float


class Sale(BaseModel):
    id: str = Field(default_factory=new_id)
    number: str
    date: str
    channel: Literal["B2B", "B2C"]
    customer_id: Optional[str] = None
    customer_name: str = ""
    items: List[SaleItem]
    subtotal: float
    vat_total: float
    total: float
    cogs: float
    payment_method: PaymentMethod
    account_id: Optional[str] = None
    account_name: str = ""
    status: SaleStatus
    notes: str = ""
    created_at: datetime = Field(default_factory=now_utc)


class SaleStatusIn(BaseModel):
    status: SaleStatus


# ---------- Finance ----------
class AccountIn(BaseModel):
    name: str = Field(min_length=1)
    type: Literal["cash", "bank", "pos"]
    currency: Currency = "TRY"
    opening_balance: float = 0
    iban: str = ""


class Account(AccountIn):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=now_utc)


class AccountOut(Account):
    balance: float = 0
    balance_try: float = 0


class Transaction(BaseModel):
    id: str = Field(default_factory=new_id)
    date: str
    account_id: str
    account_name: str = ""
    direction: Literal["in", "out"]
    amount: float
    currency: Currency
    amount_try: float
    category: str
    description: str = ""
    ref_type: str
    ref_id: Optional[str] = None
    contact_id: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)


class ManualTxIn(BaseModel):
    account_id: str
    direction: Literal["in", "out"]
    amount: float = Field(gt=0)
    date: str
    category: str = "Diğer"
    description: str = ""


class TransferIn(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float = Field(gt=0)
    to_amount: Optional[float] = Field(default=None, gt=0)
    date: str
    note: str = ""


class ExpenseIn(BaseModel):
    date: str
    category: str = Field(min_length=1)
    description: str = ""
    amount: float = Field(gt=0)
    currency: Currency = "TRY"
    is_fixed: bool = False
    payment: Literal["account", "credit"] = "account"
    account_id: Optional[str] = None
    supplier_id: Optional[str] = None
    document_no: str = ""


class Expense(ExpenseIn):
    id: str = Field(default_factory=new_id)
    amount_try: float
    rate: float
    supplier_name: str = ""
    account_name: str = ""
    created_at: datetime = Field(default_factory=now_utc)


class Rates(BaseModel):
    USD: float = Field(gt=0)
    EUR: float = Field(gt=0)


# ---------- Reports ----------
class SeriesPoint(BaseModel):
    key: str
    revenue: float = 0
    cogs: float = 0
    expenses: float = 0
    profit: float = 0
    cash: float = 0
    card: float = 0
    transfer: float = 0
    credit: float = 0
    orders: int = 0


class NameAmount(BaseModel):
    name: str
    amount: float


class ProductMargin(BaseModel):
    product_id: str
    name: str
    quantity: float
    revenue: float
    cogs: float
    margin_pct: float


class ProfitReport(BaseModel):
    start: str
    end: str
    group: str
    gross_sales: float
    revenue_net: float
    vat_total: float
    cogs: float
    gross_profit: float
    opex: float
    fixed_expenses: float
    variable_expenses: float
    purchases: float
    net_profit: float
    margin_pct: float
    order_count: int
    by_method: List[NameAmount]
    by_channel: List[NameAmount]
    expenses_by_category: List[NameAmount]
    series: List[SeriesPoint]
    products: List[ProductMargin]


class LowStockItem(BaseModel):
    id: str
    name: str
    kind: Literal["product", "green_bean", "material"]
    quantity: float
    critical_level: float
    unit: str


class Dashboard(BaseModel):
    today: str
    today_sales: float
    today_orders: int
    today_by_method: List[NameAmount]
    month: ProfitReport
    last14: List[SeriesPoint]
    roasted_kg_month: float
    roast_count_month: int
    avg_loss_pct: float
    low_stock: List[LowStockItem]
    recent_roasts: List[Roast]
    recent_sales: List[Sale]
    top_customers: List[NameAmount]
    receivables: float
    payables: float
    cash_total: float
    accounts: List[AccountOut]


class TopProduct(BaseModel):
    name: str
    quantity: float
    total: float


class MonthlyPoint(BaseModel):
    month: str
    total: float


class ContactDetail(BaseModel):
    contact: ContactOut
    sales: List[Sale]
    movements: List[CariMovement]
    monthly: List[MonthlyPoint]
    top_products: List[TopProduct]
    total_quantity: float
    avg_order: float
