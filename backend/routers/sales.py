"""Sales / orders: B2B + B2C, instant stock decrement, ledger posting, PDF invoice."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import require_admin
from lib.db import db
from lib.invoice import build_invoice_pdf
from lib.services import next_seq, post_cari, post_tx, r2, reverse_ref
from models.erp import Sale, SaleIn, SaleItem, SaleStatusIn

router = APIRouter(dependencies=[Depends(require_admin)], tags=["sales"])


async def create_sale(body: SaleIn) -> Sale:
    customer = None
    if body.customer_id:
        customer = await db.contacts.find_one({"id": body.customer_id})
        if not customer:
            raise HTTPException(status_code=400, detail="Müşteri bulunamadı")
    if body.payment_method == "credit" and not customer:
        raise HTTPException(status_code=400, detail="Veresiye (cari) satış için müşteri seçmelisiniz")
    account = None
    if body.payment_method != "credit":
        if not body.account_id:
            raise HTTPException(status_code=400, detail="Tahsilatın yapılacağı Kasa/Banka hesabını seçin")
        account = await db.accounts.find_one({"id": body.account_id})
        if not account:
            raise HTTPException(status_code=400, detail="Kasa/Banka hesabı bulunamadı")

    special = {sp["product_id"]: sp["price"] for sp in (customer or {}).get("special_prices", [])}
    need: dict[str, float] = {}
    items: list[SaleItem] = []
    for it in body.items:
        p = await db.products.find_one({"id": it.product_id})
        if not p:
            raise HTTPException(status_code=400, detail="Ürün bulunamadı")
        need[p["id"]] = need.get(p["id"], 0) + it.quantity
        if p.get("track_stock", True) and p.get("stock", 0) < need[p["id"]] - 1e-9:
            raise HTTPException(status_code=400, detail=f"Yetersiz stok: {p['name']} (mevcut {p.get('stock', 0):g} {p['unit']})")
        price = it.unit_price if it.unit_price is not None else special.get(p["id"], p["price_b2b"] if body.channel == "B2B" else p["price_b2c"])
        total = r2(price * it.quantity)
        net = r2(total / (1 + p["vat_rate"] / 100))
        items.append(SaleItem(
            product_id=p["id"], name=p["name"], sku=p["sku"], unit=p["unit"], quantity=it.quantity, unit_price=r2(price),
            vat_rate=p["vat_rate"], total=total, net=net, vat=r2(total - net), unit_cost=p.get("unit_cost", 0),
        ))
    sale = Sale(
        number=f"CCH-{body.date[:4]}-{await next_seq('sale'):05d}", date=body.date, channel=body.channel,
        customer_id=body.customer_id, customer_name=customer["name"] if customer else "", items=items,
        subtotal=r2(sum(i.net for i in items)), vat_total=r2(sum(i.vat for i in items)), total=r2(sum(i.total for i in items)),
        cogs=r2(sum(i.unit_cost * i.quantity for i in items)), payment_method=body.payment_method,
        account_id=account["id"] if account else None, account_name=account["name"] if account else "",
        status=body.status, notes=body.notes,
    )
    await db.sales.insert_one(sale.model_dump())
    for pid, q in need.items():
        await db.products.update_one({"id": pid, "track_stock": True}, {"$inc": {"stock": -q}})
    if body.payment_method == "credit":
        await post_cari(contact_id=customer["id"], amount=sale.total, date=sale.date, description=f"Satış {sale.number}", ref_type="sale", ref_id=sale.id)  # type: ignore[index]
    else:
        await post_tx(account_id=account["id"], direction="in", date=sale.date, category="Satış Geliri", description=f"Satış {sale.number}",  # type: ignore[index]
                      ref_type="sale", ref_id=sale.id, contact_id=body.customer_id, amount_try=sale.total)
    return sale


async def _restore_stock(sale: dict) -> None:
    for it in sale["items"]:
        await db.products.update_one({"id": it["product_id"], "track_stock": True}, {"$inc": {"stock": it["quantity"]}})


@router.get("/sales", response_model=List[Sale])
async def list_sales(channel: Optional[str] = None, customer_id: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None):
    q: dict = {}
    if channel:
        q["channel"] = channel
    if customer_id:
        q["customer_id"] = customer_id
    if start or end:
        q["date"] = {k: v for k, v in (("$gte", start), ("$lte", end)) if v}
    return [Sale(**s) for s in await db.sales.find(q).sort([("date", -1), ("created_at", -1)]).to_list(2000)]


@router.post("/sales", response_model=Sale)
async def add_sale(body: SaleIn):
    return await create_sale(body)


@router.get("/sales/{id}", response_model=Sale)
async def get_sale(id: str):
    s = await db.sales.find_one({"id": id})
    if not s:
        raise HTTPException(status_code=404, detail="Satış bulunamadı")
    return Sale(**s)


@router.patch("/sales/{id}/status", response_model=Sale)
async def update_status(id: str, body: SaleStatusIn):
    s = await db.sales.find_one({"id": id})
    if not s:
        raise HTTPException(status_code=404, detail="Satış bulunamadı")
    if s["status"] == "İptal" and body.status != "İptal":
        raise HTTPException(status_code=400, detail="İptal edilen satış yeniden açılamaz")
    if body.status == "İptal" and s["status"] != "İptal":
        await _restore_stock(s)
        await reverse_ref(id)
    doc = await db.sales.find_one_and_update({"id": id}, {"$set": {"status": body.status}}, return_document=True)
    return Sale(**doc)


@router.delete("/sales/{id}")
async def delete_sale(id: str):
    s = await db.sales.find_one({"id": id})
    if not s:
        raise HTTPException(status_code=404, detail="Satış bulunamadı")
    if s["status"] != "İptal":
        await _restore_stock(s)
    await reverse_ref(id)
    await db.sales.delete_one({"id": id})
    return {"ok": True}


@router.get("/sales/{id}/pdf")
async def sale_pdf(id: str):
    s = await db.sales.find_one({"id": id})
    if not s:
        raise HTTPException(status_code=404, detail="Satış bulunamadı")
    customer = await db.contacts.find_one({"id": s["customer_id"]}) if s.get("customer_id") else None
    pdf = build_invoice_pdf(s, customer)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{s["number"]}.pdf"'})
