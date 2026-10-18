"""Shared business services: rates, ledger postings, balances, expenses, counters, stock alerts."""

import uuid
from typing import Optional

from fastapi import HTTPException
from pymongo import ReturnDocument

from lib.db import db
from models.erp import CariMovement, Expense, ExpenseIn, LowStockItem, Transaction

TZ = "Europe/Istanbul"


def new_ref() -> str:
    return str(uuid.uuid4())


def r2(x: float) -> float:
    return round(float(x) + 0.0, 2)


async def get_rates() -> dict:
    doc = await db.settings.find_one({"id": "rates"}) or {}
    return {"TRY": 1.0, "USD": float(doc.get("USD", 41.5)), "EUR": float(doc.get("EUR", 48.2))}


async def next_seq(name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return int(doc["seq"])


async def post_tx(
    *,
    account_id: str,
    direction: str,
    date: str,
    category: str,
    description: str,
    ref_type: str,
    ref_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    amount_try: Optional[float] = None,
    amount: Optional[float] = None,
) -> Transaction:
    """Record money in/out of a Kasa/Banka account. Give amount (account currency) or amount_try."""
    acc = await db.accounts.find_one({"id": account_id})
    if not acc:
        raise HTTPException(status_code=400, detail="Kasa/Banka hesabı bulunamadı")
    rate = (await get_rates())[acc["currency"]]
    if amount is None:
        amount = (amount_try or 0) / rate
    if amount_try is None:
        amount_try = amount * rate
    tx = Transaction(
        date=date,
        account_id=account_id,
        account_name=acc["name"],
        direction=direction,  # type: ignore[arg-type]
        amount=r2(amount),
        currency=acc["currency"],
        amount_try=r2(amount_try),
        category=category,
        description=description,
        ref_type=ref_type,
        ref_id=ref_id,
        contact_id=contact_id,
    )
    await db.transactions.insert_one(tx.model_dump())
    return tx


async def post_cari(*, contact_id: str, amount: float, date: str, description: str, ref_type: str, ref_id: Optional[str]) -> None:
    mv = CariMovement(contact_id=contact_id, amount=r2(amount), date=date, description=description, ref_type=ref_type, ref_id=ref_id)
    await db.cari_movements.insert_one(mv.model_dump())


async def reverse_ref(ref_id: str) -> None:
    await db.transactions.delete_many({"ref_id": ref_id})
    await db.cari_movements.delete_many({"ref_id": ref_id})


async def account_balances() -> list[dict]:
    rates = await get_rates()
    sums: dict[str, float] = {}
    async for row in db.transactions.aggregate(
        [{"$group": {"_id": {"a": "$account_id", "d": "$direction"}, "s": {"$sum": "$amount"}}}]
    ):
        sign = 1 if row["_id"]["d"] == "in" else -1
        sums[row["_id"]["a"]] = sums.get(row["_id"]["a"], 0) + sign * row["s"]
    out = []
    for acc in await db.accounts.find().sort("created_at", 1).to_list(500):
        bal = acc.get("opening_balance", 0) + sums.get(acc["id"], 0)
        out.append({**acc, "balance": r2(bal), "balance_try": r2(bal * rates[acc["currency"]])})
    return out


async def contact_balances() -> dict[str, float]:
    res: dict[str, float] = {}
    async for row in db.cari_movements.aggregate([{"$group": {"_id": "$contact_id", "s": {"$sum": "$amount"}}}]):
        res[row["_id"]] = r2(row["s"])
    return res


async def create_expense(data: ExpenseIn) -> Expense:
    rate = (await get_rates())[data.currency]
    amount_try = r2(data.amount * rate)
    supplier = None
    if data.supplier_id:
        supplier = await db.contacts.find_one({"id": data.supplier_id})
        if not supplier:
            raise HTTPException(status_code=400, detail="Tedarikçi bulunamadı")
    account = None
    if data.payment == "account":
        if not data.account_id:
            raise HTTPException(status_code=400, detail="Ödeme yapılan Kasa/Banka hesabını seçin")
        account = await db.accounts.find_one({"id": data.account_id})
        if not account:
            raise HTTPException(status_code=400, detail="Kasa/Banka hesabı bulunamadı")
    elif not supplier:
        raise HTTPException(status_code=400, detail="Vadeli (cari) gider için tedarikçi seçin")

    exp = Expense(
        **data.model_dump(),
        amount_try=amount_try,
        rate=rate,
        supplier_name=supplier["name"] if supplier else "",
        account_name=account["name"] if account else "",
    )
    await db.expenses.insert_one(exp.model_dump())
    desc = data.description or data.category
    if account:
        same_cur = account["currency"] == data.currency
        await post_tx(
            account_id=account["id"], direction="out", date=data.date, category=data.category, description=desc,
            ref_type="expense", ref_id=exp.id, contact_id=data.supplier_id,
            amount_try=amount_try, amount=data.amount if same_cur else None,
        )
    else:
        await post_cari(contact_id=data.supplier_id or "", amount=-amount_try, date=data.date, description=desc, ref_type="expense", ref_id=exp.id)
    return exp


async def low_stock_items() -> list[LowStockItem]:
    items: list[LowStockItem] = []
    for p in await db.products.find({"track_stock": True}).to_list(2000):
        if p.get("critical_level", 0) > 0 and p.get("stock", 0) <= p["critical_level"]:
            items.append(LowStockItem(id=p["id"], name=p["name"], kind="product", quantity=p["stock"], critical_level=p["critical_level"], unit=p["unit"]))
    for m in await db.materials.find().to_list(2000):
        if m.get("critical_level", 0) > 0 and m.get("quantity", 0) <= m["critical_level"]:
            items.append(LowStockItem(id=m["id"], name=m["name"], kind=m["kind"], quantity=m["quantity"], critical_level=m["critical_level"], unit=m.get("unit", "")))
    return items
