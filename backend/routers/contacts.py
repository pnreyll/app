"""CRM customers + suppliers (cari hesaplar), payments, detail analytics."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.db import db
from lib.services import contact_balances, new_ref, post_cari, post_tx, r2
from models.erp import (
    CariMovement, Contact, ContactDetail, ContactIn, ContactOut, ContactPaymentIn, MonthlyPoint, Sale, TopProduct,
)

router = APIRouter(dependencies=[Depends(require_admin)], tags=["contacts"])


async def _sales_stats() -> dict[str, dict]:
    stats: dict[str, dict] = {}
    async for row in db.sales.aggregate([
        {"$match": {"status": {"$ne": "İptal"}, "customer_id": {"$ne": None}}},
        {"$group": {"_id": "$customer_id", "total": {"$sum": "$total"}, "count": {"$sum": 1}, "last": {"$max": "$date"}}},
    ]):
        stats[row["_id"]] = row
    return stats


async def _contact_out(doc: dict, balances: dict, stats: dict) -> ContactOut:
    s = stats.get(doc["id"], {})
    return ContactOut(**doc, balance=balances.get(doc["id"], 0), total_sales=r2(s.get("total", 0)),
                      order_count=s.get("count", 0), last_order_date=s.get("last"))


@router.get("/contacts", response_model=List[ContactOut])
async def list_contacts(type: Optional[str] = None):
    q = {"type": type} if type else {}
    balances, stats = await contact_balances(), await _sales_stats()
    return [await _contact_out(c, balances, stats) for c in await db.contacts.find(q).sort("name", 1).to_list(2000)]


@router.post("/contacts", response_model=ContactOut)
async def create_contact(body: ContactIn):
    c = Contact(**body.model_dump())
    await db.contacts.insert_one(c.model_dump())
    return ContactOut(**c.model_dump())


@router.put("/contacts/{id}", response_model=ContactOut)
async def update_contact(id: str, body: ContactIn):
    doc = await db.contacts.find_one_and_update({"id": id}, {"$set": body.model_dump()}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return await _contact_out(doc, await contact_balances(), await _sales_stats())


@router.delete("/contacts/{id}")
async def delete_contact(id: str):
    if await db.cari_movements.find_one({"contact_id": id}) or await db.sales.find_one({"customer_id": id}):
        raise HTTPException(status_code=400, detail="Hareketi olan cari hesap silinemez")
    res = await db.contacts.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return {"ok": True}


@router.get("/contacts/{id}", response_model=ContactDetail)
async def contact_detail(id: str):
    doc = await db.contacts.find_one({"id": id})
    if not doc:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    contact = await _contact_out(doc, await contact_balances(), await _sales_stats())
    sales = [Sale(**s) for s in await db.sales.find({"customer_id": id}).sort([("date", -1), ("created_at", -1)]).to_list(2000)]
    movements = [CariMovement(**m) for m in await db.cari_movements.find({"contact_id": id}).sort([("date", -1), ("created_at", -1)]).to_list(2000)]
    monthly: dict[str, float] = {}
    products: dict[str, dict] = {}
    total_qty = 0.0
    active = [s for s in sales if s.status != "İptal"]
    for s in active:
        monthly[s.date[:7]] = monthly.get(s.date[:7], 0) + s.total
        for it in s.items:
            p = products.setdefault(it.name, {"quantity": 0.0, "total": 0.0})
            p["quantity"] += it.quantity
            p["total"] += it.total
            total_qty += it.quantity
    top = sorted((TopProduct(name=k, quantity=r2(v["quantity"]), total=r2(v["total"])) for k, v in products.items()), key=lambda x: -x.total)[:6]
    return ContactDetail(
        contact=contact, sales=sales, movements=movements,
        monthly=[MonthlyPoint(month=k, total=r2(v)) for k, v in sorted(monthly.items())],
        top_products=top, total_quantity=r2(total_qty), avg_order=r2(sum(s.total for s in active) / len(active)) if active else 0,
    )


@router.post("/contacts/{id}/payment")
async def contact_payment(id: str, body: ContactPaymentIn):
    c = await db.contacts.find_one({"id": id})
    if not c:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    ref = new_ref()
    if c["type"] == "customer":
        desc = body.note or f"Tahsilat - {c['name']}"
        await post_tx(account_id=body.account_id, direction="in", date=body.date, category="Cari Tahsilat", description=desc, ref_type="payment", ref_id=ref, contact_id=id, amount_try=body.amount)
        await post_cari(contact_id=id, amount=-body.amount, date=body.date, description=desc, ref_type="payment", ref_id=ref)
    else:
        desc = body.note or f"Ödeme - {c['name']}"
        await post_tx(account_id=body.account_id, direction="out", date=body.date, category="Tedarikçi Ödemesi", description=desc, ref_type="payment", ref_id=ref, contact_id=id, amount_try=body.amount)
        await post_cari(contact_id=id, amount=body.amount, date=body.date, description=desc, ref_type="payment", ref_id=ref)
    return {"ok": True}


@router.delete("/cari-movements/{id}")
async def delete_movement(id: str):
    m = await db.cari_movements.find_one({"id": id})
    if not m:
        raise HTTPException(status_code=404, detail="Hareket bulunamadı")
    if m["ref_type"] != "payment":
        raise HTTPException(status_code=400, detail="Bu hareket satış/gider kaydından oluştu; ilgili kayıttan silin")
    await db.cari_movements.delete_many({"ref_id": m["ref_id"]})
    await db.transactions.delete_many({"ref_id": m["ref_id"]})
    return {"ok": True}
