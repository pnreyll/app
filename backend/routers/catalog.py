"""Products, materials (green beans + packaging), roasting batches, stock alerts."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.db import db
from lib.services import create_expense, low_stock_items, next_seq, r2
from models.erp import (
    RAW_PURCHASE_CATEGORY, ExpenseIn, LowStockItem, Material, MaterialIn, MaterialOut, Product, ProductIn,
    PurchaseIn, Roast, RoastIn, RoastInputLine, StockAdjustIn,
)

router = APIRouter(dependencies=[Depends(require_admin)], tags=["catalog"])


# ---------- Products ----------
@router.get("/products", response_model=List[Product])
async def list_products():
    return [Product(**p) for p in await db.products.find().sort([("category", 1), ("name", 1)]).to_list(2000)]


@router.post("/products", response_model=Product)
async def create_product(body: ProductIn):
    if await db.products.find_one({"sku": body.sku}):
        raise HTTPException(status_code=400, detail="Bu SKU / stok kodu zaten kayıtlı")
    p = Product(**body.model_dump())
    await db.products.insert_one(p.model_dump())
    return p


@router.put("/products/{id}", response_model=Product)
async def update_product(id: str, body: ProductIn):
    if await db.products.find_one({"sku": body.sku, "id": {"$ne": id}}):
        raise HTTPException(status_code=400, detail="Bu SKU / stok kodu zaten kayıtlı")
    doc = await db.products.find_one_and_update({"id": id}, {"$set": body.model_dump()}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return Product(**doc)


@router.delete("/products/{id}")
async def delete_product(id: str):
    res = await db.products.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return {"ok": True}


@router.post("/products/{id}/adjust", response_model=Product)
async def adjust_product(id: str, body: StockAdjustIn):
    doc = await db.products.find_one_and_update({"id": id}, {"$inc": {"stock": body.delta}}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return Product(**doc)


# ---------- Materials ----------
async def _material_out(docs: list[dict]) -> list[MaterialOut]:
    names = {c["id"]: c["name"] for c in await db.contacts.find({"type": "supplier"}).to_list(1000)}
    return [MaterialOut(**d, supplier_name=names.get(d.get("supplier_id") or "", "")) for d in docs]


@router.get("/materials", response_model=List[MaterialOut])
async def list_materials(kind: Optional[str] = None):
    q = {"kind": kind} if kind else {}
    return await _material_out(await db.materials.find(q).sort("name", 1).to_list(2000))


@router.post("/materials", response_model=MaterialOut)
async def create_material(body: MaterialIn):
    m = Material(**body.model_dump())
    await db.materials.insert_one(m.model_dump())
    return (await _material_out([m.model_dump()]))[0]


@router.put("/materials/{id}", response_model=MaterialOut)
async def update_material(id: str, body: MaterialIn):
    doc = await db.materials.find_one_and_update({"id": id}, {"$set": body.model_dump()}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return (await _material_out([doc]))[0]


@router.delete("/materials/{id}")
async def delete_material(id: str):
    res = await db.materials.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return {"ok": True}


@router.post("/materials/{id}/adjust", response_model=MaterialOut)
async def adjust_material(id: str, body: StockAdjustIn):
    doc = await db.materials.find_one_and_update({"id": id}, {"$inc": {"quantity": body.delta}}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return (await _material_out([doc]))[0]


@router.post("/materials/{id}/purchase", response_model=MaterialOut)
async def purchase_material(id: str, body: PurchaseIn):
    m = await db.materials.find_one({"id": id})
    if not m:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    supplier_id = body.supplier_id or m.get("supplier_id")
    await create_expense(
        ExpenseIn(
            date=body.date, category=RAW_PURCHASE_CATEGORY,
            description=f"{m['name']} alımı ({body.quantity:g} {m.get('unit', '')})",
            amount=r2(body.quantity * body.unit_price), currency=body.currency, payment=body.payment,
            account_id=body.account_id, supplier_id=supplier_id,
        )
    )
    doc = await db.materials.find_one_and_update(
        {"id": id},
        {"$inc": {"quantity": body.quantity}, "$set": {"purchase_price": body.unit_price, "currency": body.currency, "supplier_id": supplier_id}},
        return_document=True,
    )
    return (await _material_out([doc]))[0]


# ---------- Roasting ----------
async def create_roast(body: RoastIn) -> Roast:
    product = await db.products.find_one({"id": body.output_product_id})
    if not product:
        raise HTTPException(status_code=400, detail="Hedef ürün bulunamadı")
    mats = []
    for inp in body.inputs:
        m = await db.materials.find_one({"id": inp.material_id})
        if not m:
            raise HTTPException(status_code=400, detail="Hammadde bulunamadı")
        if m["quantity"] < inp.quantity - 1e-9:
            raise HTTPException(status_code=400, detail=f"Yetersiz stok: {m['name']} (mevcut {m['quantity']:g} {m.get('unit', '')})")
        mats.append((m, inp.quantity))
    lines, green_kg = [], 0.0
    for m, qty in mats:
        await db.materials.update_one({"id": m["id"]}, {"$inc": {"quantity": -qty}})
        lines.append(RoastInputLine(material_id=m["id"], name=m["name"], quantity=qty, unit=m.get("unit", ""), kind=m["kind"]))
        if m["kind"] == "green_bean":
            green_kg += qty
    await db.products.update_one({"id": product["id"]}, {"$inc": {"stock": body.output_quantity}})
    loss = round((green_kg - body.output_quantity) / green_kg * 100, 1) if green_kg > 0 and product["unit"] == "KG" else 0
    roast = Roast(
        batch_no=f"R-{await next_seq('roast'):04d}", date=body.date, inputs=lines, green_kg=r2(green_kg),
        output_product_id=product["id"], output_product_name=product["name"], output_unit=product["unit"],
        output_quantity=body.output_quantity, loss_pct=loss, notes=body.notes,
    )
    await db.roasts.insert_one(roast.model_dump())
    return roast


@router.get("/roasts", response_model=List[Roast])
async def list_roasts():
    return [Roast(**r) for r in await db.roasts.find().sort([("date", -1), ("created_at", -1)]).to_list(1000)]


@router.post("/roasts", response_model=Roast)
async def add_roast(body: RoastIn):
    return await create_roast(body)


@router.delete("/roasts/{id}")
async def delete_roast(id: str):
    r = await db.roasts.find_one({"id": id})
    if not r:
        raise HTTPException(status_code=404, detail="Kavurma kaydı bulunamadı")
    for line in r["inputs"]:
        await db.materials.update_one({"id": line["material_id"]}, {"$inc": {"quantity": line["quantity"]}})
    await db.products.update_one({"id": r["output_product_id"]}, {"$inc": {"stock": -r["output_quantity"]}})
    await db.roasts.delete_one({"id": id})
    return {"ok": True}


@router.get("/stock/alerts", response_model=List[LowStockItem])
async def stock_alerts():
    return await low_stock_items()
