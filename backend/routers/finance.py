"""Kasa & Banka accounts, transactions, transfers, expenses, exchange rates."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.dates import today_iso
from lib.db import db
from lib.services import TZ, account_balances, create_expense, get_rates, new_ref, post_tx, reverse_ref
from models.erp import (
    Account, AccountIn, AccountOut, Expense, ExpenseIn, ManualTxIn, Rates, Transaction, TransferIn,
)

router = APIRouter(dependencies=[Depends(require_admin)], tags=["finance"])


@router.get("/accounts", response_model=List[AccountOut])
async def list_accounts():
    return [AccountOut(**a) for a in await account_balances()]


@router.post("/accounts", response_model=AccountOut)
async def create_account(body: AccountIn):
    a = Account(**body.model_dump())
    await db.accounts.insert_one(a.model_dump())
    rate = (await get_rates())[a.currency]
    return AccountOut(**a.model_dump(), balance=a.opening_balance, balance_try=round(a.opening_balance * rate, 2))


@router.put("/accounts/{id}", response_model=AccountOut)
async def update_account(id: str, body: AccountIn):
    doc = await db.accounts.find_one_and_update({"id": id}, {"$set": body.model_dump()}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Hesap bulunamadı")
    return next(AccountOut(**a) for a in await account_balances() if a["id"] == id)


@router.delete("/accounts/{id}")
async def delete_account(id: str):
    if await db.transactions.find_one({"account_id": id}):
        raise HTTPException(status_code=400, detail="Hareket görmüş hesap silinemez")
    res = await db.accounts.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Hesap bulunamadı")
    return {"ok": True}


@router.get("/transactions", response_model=List[Transaction])
async def list_transactions(account_id: Optional[str] = None, limit: int = 300):
    q = {"account_id": account_id} if account_id else {}
    return [Transaction(**t) for t in await db.transactions.find(q).sort([("date", -1), ("created_at", -1)]).to_list(limit)]


@router.post("/transactions", response_model=Transaction)
async def add_transaction(body: ManualTxIn):
    return await post_tx(account_id=body.account_id, direction=body.direction, date=body.date, category=body.category,
                         description=body.description, ref_type="manual", ref_id=new_ref(), amount=body.amount)


@router.delete("/transactions/{id}")
async def delete_transaction(id: str):
    t = await db.transactions.find_one({"id": id})
    if not t:
        raise HTTPException(status_code=404, detail="Hareket bulunamadı")
    if t["ref_type"] not in ("manual", "transfer"):
        raise HTTPException(status_code=400, detail="Bu hareket satış/gider/cari kaydından oluştu; ilgili kayıttan silin")
    await reverse_ref(t["ref_id"])
    return {"ok": True}


@router.post("/accounts/transfer")
async def transfer(body: TransferIn):
    if body.from_account_id == body.to_account_id:
        raise HTTPException(status_code=400, detail="Aynı hesaplar arasında virman yapılamaz")
    src = await db.accounts.find_one({"id": body.from_account_id})
    dst = await db.accounts.find_one({"id": body.to_account_id})
    if not src or not dst:
        raise HTTPException(status_code=400, detail="Hesap bulunamadı")
    rates = await get_rates()
    amount_try = body.amount * rates[src["currency"]]
    to_amount = body.to_amount if body.to_amount is not None else amount_try / rates[dst["currency"]]
    ref = new_ref()
    desc = body.note or f"{src['name']} → {dst['name']}"
    await post_tx(account_id=src["id"], direction="out", date=body.date, category="Virman", description=desc, ref_type="transfer", ref_id=ref, amount=body.amount, amount_try=amount_try)
    await post_tx(account_id=dst["id"], direction="in", date=body.date, category="Virman", description=desc, ref_type="transfer", ref_id=ref, amount=to_amount, amount_try=amount_try)
    return {"ok": True}


@router.get("/expenses", response_model=List[Expense])
async def list_expenses(start: Optional[str] = None, end: Optional[str] = None, category: Optional[str] = None):
    q: dict = {}
    if start or end:
        q["date"] = {k: v for k, v in (("$gte", start), ("$lte", end)) if v}
    if category:
        q["category"] = category
    return [Expense(**e) for e in await db.expenses.find(q).sort([("date", -1), ("created_at", -1)]).to_list(3000)]


@router.post("/expenses", response_model=Expense)
async def add_expense(body: ExpenseIn):
    return await create_expense(body)


@router.delete("/expenses/{id}")
async def delete_expense(id: str):
    res = await db.expenses.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Gider bulunamadı")
    await reverse_ref(id)
    return {"ok": True}


@router.get("/today")
async def today():
    return {"today": today_iso(TZ)}


@router.get("/settings/rates", response_model=Rates)
async def read_rates():
    r = await get_rates()
    return Rates(USD=r["USD"], EUR=r["EUR"])


@router.put("/settings/rates", response_model=Rates)
async def save_rates(body: Rates):
    await db.settings.update_one({"id": "rates"}, {"$set": body.model_dump()}, upsert=True)
    return body
