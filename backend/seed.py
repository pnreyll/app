"""Demo seed for Chrono Coffee House. `python seed.py` seeds only if empty; `python seed.py --reset` wipes & reseeds."""

import asyncio
import random
import sys
from datetime import date, timedelta

from lib.auth import hash_password
from lib.dates import today_iso
from lib.db import db, ensure_indexes
from lib.services import TZ, create_expense, post_cari, post_tx
from models.erp import (
    RAW_PURCHASE_CATEGORY, Account, Contact, ExpenseIn, Material, Product, RoastIn, RoastInput, SaleIn, SaleItemIn, SpecialPrice, new_id,
)
from routers.catalog import create_roast
from routers.sales import create_sale

ADMIN_EMAIL, ADMIN_PASSWORD = "admin@chronocoffee.com", "admin123"
COLLECTIONS = ["products", "materials", "roasts", "contacts", "sales", "accounts", "transactions", "cari_movements", "expenses", "counters", "settings"]


async def ensure_admin():
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({"id": new_id(), "email": ADMIN_EMAIL, "name": "Chrono Admin", "password_hash": hash_password(ADMIN_PASSWORD)})


async def seed():
    rng = random.Random(42)
    today = date.fromisoformat(today_iso(TZ))
    iso = lambda d: d.isoformat()  # noqa: E731
    await db.settings.insert_one({"id": "rates", "USD": 41.5, "EUR": 48.2})

    acc = {k: Account(name=n, type=t, currency=c, opening_balance=o, iban=i) for k, n, t, c, o, i in [
        ("cash", "Merkez Kasa", "cash", "TRY", 15000, ""),
        ("garanti", "Garanti BBVA Ticari TL", "bank", "TRY", 185000, "TR12 0006 2000 1234 0006 2987 45"),
        ("pos", "Akbank POS Hesabı", "pos", "TRY", 0, ""),
        ("usd", "İş Bankası USD Hesabı", "bank", "USD", 4200, "TR45 0006 4000 0021 2345 6789 01"),
    ]}
    await db.accounts.insert_many([a.model_dump() for a in acc.values()])

    sup = {k: Contact(type="supplier", name=n, company_type=ct, contact_person=cp, phone=ph, email=em, city=city, tax_no=tx, payment_term_days=30) for k, n, ct, cp, ph, em, city, tx in [
        ("green", "Anatolia Green Coffee İthalat A.Ş.", "İthalatçı", "Kerem Aksoy", "0212 555 41 10", "satis@anatoliagreen.com", "İstanbul", "0680012345"),
        ("pack", "Ambalaj Dünyası Ltd. Şti.", "Ambalaj Tedarikçisi", "Selin Kaya", "0216 444 22 33", "info@ambalajdunyasi.com", "Kocaeli", "0720098765"),
        ("milk", "Sütçü Mehmet Gıda", "Gıda Tedarikçisi", "Mehmet Öz", "0532 111 22 33", "siparis@sutcumehmet.com", "İstanbul", "4410056789"),
    ]}
    await db.contacts.insert_many([c.model_dump() for c in sup.values()])

    P = {k: Product(name=n, sku=s, category=c, unit=u, vat_rate=v, price_b2c=b2c, price_b2b=b2b, unit_cost=cost, stock=9999, critical_level=crit, track_stock=tr) for k, n, s, c, u, v, b2c, b2b, cost, crit, tr in [
        ("sig", "Chrono Signature Blend 250g", "CCH-SIG-250", "Kavrulmuş Paket Kahve", "Paket", 10, 420, 340, 190, 30, True),
        ("eth", "Etiyopya Yirgacheffe 250g", "CCH-ETH-250", "Kavrulmuş Paket Kahve", "Paket", 10, 520, 430, 240, 20, True),
        ("col", "Kolombiya Huila 250g", "CCH-COL-250", "Kavrulmuş Paket Kahve", "Paket", 10, 480, 390, 215, 20, True),
        ("esp1", "Chrono Espresso Blend 1kg", "CCH-ESP-1000", "Kavrulmuş Paket Kahve", "Paket", 10, 1450, 1150, 680, 10, True),
        ("espb", "Espresso Blend (Dökme Kavrulmuş)", "CCH-ESP-BULK", "Kavrulmuş Dökme Kahve", "KG", 10, 1300, 1050, 620, 10, True),
        ("ethb", "Etiyopya Yirgacheffe (Dökme Kavrulmuş)", "CCH-ETH-BULK", "Kavrulmuş Dökme Kahve", "KG", 10, 1700, 1400, 780, 5, True),
        ("latte", "Latte", "MNU-LATTE", "Kafe Menüsü", "Adet", 10, 145, 145, 38, 0, False),
        ("flat", "Flat White", "MNU-FLAT", "Kafe Menüsü", "Adet", 10, 150, 150, 40, 0, False),
        ("v60", "Filtre Kahve (V60)", "MNU-V60", "Kafe Menüsü", "Adet", 10, 165, 165, 45, 0, False),
        ("esp", "Espresso", "MNU-ESP", "Kafe Menüsü", "Adet", 10, 95, 95, 22, 0, False),
        ("cake", "San Sebastian Cheesecake", "MNU-CAKE", "Kafe Menüsü", "Adet", 10, 190, 190, 70, 0, False),
        ("drip", "Hario V60 Dripper 02", "EKP-V60-02", "Ekipman & Aksesuar", "Adet", 20, 950, 780, 560, 3, True),
        ("mug", "Chrono Termos Kupa", "EKP-MUG-01", "Ekipman & Aksesuar", "Adet", 20, 650, 520, 290, 5, True),
    ]}
    await db.products.insert_many([p.model_dump() for p in P.values()])
    targets = {"sig": 118, "eth": 54, "col": 14, "esp1": 36, "espb": 28, "ethb": 11, "drip": 8, "mug": 4}

    M = {k: Material(kind=kind, name=n, category=cat, lot_no=lot, origin=o, variety=v, process=pr, supplier_id=sup[s].id, purchase_price=price, currency=cur, unit=u, quantity=9999, critical_level=crit) for k, kind, n, cat, lot, o, v, pr, s, price, cur, u, crit in [
        ("g_eth", "green_bean", "Etiyopya Yirgacheffe G1", "Yeşil Çekirdek", "ETH-2026-01", "Etiyopya", "Heirloom", "Yıkanmış", "green", 7.8, "USD", "KG", 60),
        ("g_col", "green_bean", "Kolombiya Huila Supremo", "Yeşil Çekirdek", "COL-2026-02", "Kolombiya", "Caturra", "Yıkanmış", "green", 8.2, "USD", "KG", 60),
        ("g_bra", "green_bean", "Brezilya Cerrado Mogiana", "Yeşil Çekirdek", "BRA-2026-01", "Brezilya", "Yellow Bourbon", "Natural", "green", 5.9, "USD", "KG", 100),
        ("g_ken", "green_bean", "Kenya AA Nyeri", "Yeşil Çekirdek", "KEN-2025-07", "Kenya", "SL28 / SL34", "Yıkanmış", "green", 9.9, "USD", "KG", 40),
        ("m_250", "material", "250g Valfli Kraft Paket", "Ambalaj", "", "", "", "", "pack", 6.5, "TRY", "Adet", 500),
        ("m_1kg", "material", "1kg Fermuarlı Kraft Paket", "Ambalaj", "", "", "", "", "pack", 11, "TRY", "Adet", 300),
        ("m_valve", "material", "Degassing Valf", "Ambalaj", "", "", "", "", "pack", 1.8, "TRY", "Adet", 1000),
        ("m_label", "material", "Chrono Etiket Rulosu", "Etiket", "", "", "", "", "pack", 450, "TRY", "Rulo", 3),
        ("m_cup", "material", "Karton Bardak 8oz", "Kafe Sarf", "", "", "", "", "pack", 2.4, "TRY", "Adet", 1000),
        ("m_milk", "material", "Tam Yağlı Süt", "Kafe Sarf", "", "", "", "", "milk", 38, "TRY", "Litre", 40),
        ("m_syrup", "material", "Vanilya Şurubu 700ml", "Kafe Sarf", "", "", "", "", "milk", 320, "TRY", "Şişe", 4),
    ]}
    await db.materials.insert_many([m.model_dump() for m in M.values()])
    m_targets = {"g_eth": 180, "g_col": 45, "g_bra": 320, "g_ken": 70, "m_250": 1400, "m_1kg": 220, "m_valve": 2600, "m_label": 6, "m_cup": 1800, "m_milk": 24, "m_syrup": 9}

    cust = {k: Contact(type="customer", name=n, company_type=ct, segment=seg, contact_person=cp, phone=ph, email=em, address=ad, city=city, tax_no=tx, notes=notes, favorite_beans=fav, payment_term_days=term, special_prices=sp) for k, n, ct, seg, cp, ph, em, ad, city, tx, notes, fav, term, sp in [
        ("moda", "Moda Sahil Kafe", "Butik Kafe", "Sadık Kafe (B2B)", "Burak Eren", "0532 444 10 20", "burak@modasahil.com", "Moda Cad. No: 48", "İstanbul", "6120045678",
         "Haftalık düzenli sipariş. Cuma teslim tercih ediyor. Espresso için orta-koyu kavrum istiyor.", "Signature Blend, Etiyopya Yirgacheffe", 30,
         [SpecialPrice(product_id=P["sig"].id, price=320), SpecialPrice(product_id=P["espb"].id, price=990)]),
        ("brew", "Kadıköy Brew Bar", "Butik Kafe", "Yeni B2B", "Deniz Arslan", "0533 222 30 40", "hello@kadikoybrew.com", "Bahariye Cad. No: 7", "İstanbul", "7230011223",
         "Filtre kahve odaklı; açık kavrum single origin tercih ediyor.", "Etiyopya, Kenya AA", 15, []),
        ("lab", "Nişantaşı Coffee Lab", "Kafe Zinciri", "Kurumsal (B2B)", "Ece Tan", "0212 333 50 60", "satinalma@coffeelab.com.tr", "Abdi İpekçi Cad. No: 21", "İstanbul", "8340099887",
         "3 şube. Aylık fatura, 45 gün vade.", "Espresso Blend 1kg", 45, [SpecialPrice(product_id=P["esp1"].id, price=1090)]),
        ("ayse", "Ayşe Yılmaz", "Son Tüketici", "VIP Perakende", "", "0535 666 70 80", "ayse.yilmaz@gmail.com", "Caferağa Mah.", "İstanbul", "",
         "Her ay 2 paket alıyor, meyvemsi notaları seviyor. Doğum günü: 14 Mart.", "Etiyopya Yirgacheffe", 0, []),
        ("can", "Can Demir", "Son Tüketici", "B2C Abonman", "", "0536 777 80 90", "can.demir@outlook.com", "Ataşehir", "İstanbul", "",
         "Aylık abonman. Öğütülmüş (V60) istiyor.", "Kolombiya Huila", 0, []),
    ]}
    await db.contacts.insert_many([c.model_dump() for c in cust.values()])

    # Expenses: last month + this month
    for mo in (date(today.year if today.month > 1 else today.year - 1, today.month - 1 if today.month > 1 else 12, 1), today.replace(day=1)):
        d = lambda day: iso(min(mo.replace(day=day), today))  # noqa: E731
        for day, cat, desc, amount, fixed in [
            (1, "Kira", "Kafe & roastery kirası", 45000, True), (3, "İnternet & Telefon", "Fiber internet", 750, True),
            (5, "Personel Maaşı", "Barista - Elif Şahin", 32000, True), (5, "Personel Maaşı", "Kavurmacı - Murat Kılıç", 38000, True),
            (8, "Elektrik", "Kavurma makinesi + kafe elektrik", 6800, False), (9, "Su", "İSKİ su faturası", 950, False),
            (10, "Doğalgaz", "Kavurma fırını doğalgaz", 4200, False), (12, "Pazarlama & Reklam", "Instagram reklamları", 2500, False),
            (15, "Personel Ek Ödeme", "Prim / mesai ödemesi", 3000, False),
        ]:
            if mo.replace(day=day) <= today:
                await create_expense(ExpenseIn(date=d(day), category=cat, description=desc, amount=amount, is_fixed=fixed, payment="account", account_id=acc["garanti"].id, document_no=f"FT-{rng.randint(10000, 99999)}"))
    await create_expense(ExpenseIn(date=iso(today - timedelta(days=40)), category=RAW_PURCHASE_CATEGORY, description="Brezilya + Etiyopya yeşil çekirdek ithalatı", amount=3600, currency="USD", payment="credit", supplier_id=sup["green"].id, document_no="ANA-2026-114"))
    await create_expense(ExpenseIn(date=iso(today - timedelta(days=20)), category=RAW_PURCHASE_CATEGORY, description="Kraft paket & valf alımı", amount=14500, payment="account", account_id=acc["garanti"].id, supplier_id=sup["pack"].id))
    await create_expense(ExpenseIn(date=iso(today - timedelta(days=6)), category="Ambalaj & Kargo", description="Kargo gönderimleri", amount=1850, payment="credit", supplier_id=sup["pack"].id))
    await create_expense(ExpenseIn(date=iso(today - timedelta(days=4)), category=RAW_PURCHASE_CATEGORY, description="Süt ve şurup alımı", amount=6400, payment="credit", supplier_id=sup["milk"].id))

    # Roasts
    for days, inputs, out, qty, note in [
        (26, [("g_bra", 30), ("g_col", 10)], "espb", 34, "Espresso blend - orta/koyu"),
        (19, [("g_eth", 20)], "ethb", 17.1, "Light filter roast"),
        (12, [("g_bra", 30), ("g_col", 10), ("g_ken", 5)], "espb", 38.2, "Espresso blend + Kenya denemesi"),
        (5, [("g_eth", 15)], "ethb", 12.9, "Filtre profil"),
        (1, [("g_bra", 24), ("g_col", 8)], "espb", 27.4, "Haftalık espresso üretimi"),
    ]:
        await create_roast(RoastIn(date=iso(today - timedelta(days=days)), inputs=[RoastInput(material_id=M[m].id, quantity=q) for m, q in inputs], output_product_id=P[out].id, output_quantity=qty, notes=note))

    # Sales: last 60 days
    menu = ["latte", "flat", "v60", "esp", "cake"]
    for back in range(60, -1, -1):
        d = iso(today - timedelta(days=back))
        for _ in range(rng.randint(10, 16)):
            items = [SaleItemIn(product_id=P[k].id, quantity=rng.randint(1, 3)) for k in rng.sample(menu, rng.randint(1, 3))]
            if rng.random() < 0.25:
                items.append(SaleItemIn(product_id=P[rng.choice(["sig", "eth", "col", "mug"])].id, quantity=1))
            cid = None
            if rng.random() < 0.12:
                cid = cust[rng.choice(["ayse", "can"])].id
            method = rng.choice(["cash", "card", "card", "card"])
            await create_sale(SaleIn(date=d, channel="B2C", customer_id=cid, items=items, payment_method=method, account_id=acc["cash" if method == "cash" else "pos"].id))
        if back % 4 == 0:
            ck = rng.choice(["moda", "moda", "brew", "lab"])
            prods = {"moda": [("sig", 10, 20), ("espb", 3, 6)], "brew": [("eth", 5, 10), ("ethb", 1, 3)], "lab": [("esp1", 8, 15), ("drip", 1, 2)]}[ck]
            items = [SaleItemIn(product_id=P[k].id, quantity=rng.randint(lo, hi)) for k, lo, hi in prods]
            method = rng.choice(["transfer", "credit"])
            status = "Teslim Edildi" if back > 6 else rng.choice(["Hazırlanıyor", "Kargolandı"])
            await create_sale(SaleIn(date=d, channel="B2B", customer_id=cust[ck].id, items=items, payment_method=method, account_id=acc["garanti"].id if method == "transfer" else None, status=status))

    # Cari payments
    pay_ref = new_id()
    d = iso(today - timedelta(days=10))
    await post_tx(account_id=acc["garanti"].id, direction="in", date=d, category="Cari Tahsilat", description="Tahsilat - Moda Sahil Kafe", ref_type="payment", ref_id=pay_ref, contact_id=cust["moda"].id, amount_try=12000)
    await post_cari(contact_id=cust["moda"].id, amount=-12000, date=d, description="Tahsilat - Moda Sahil Kafe", ref_type="payment", ref_id=pay_ref)
    pay_ref = new_id()
    d = iso(today - timedelta(days=15))
    await post_tx(account_id=acc["usd"].id, direction="out", date=d, category="Tedarikçi Ödemesi", description="Ödeme - Anatolia Green (USD)", ref_type="payment", ref_id=pay_ref, contact_id=sup["green"].id, amount=1500)
    await post_cari(contact_id=sup["green"].id, amount=1500 * 41.5, date=d, description="Ödeme - Anatolia Green (USD)", ref_type="payment", ref_id=pay_ref)

    for k, v in targets.items():
        await db.products.update_one({"id": P[k].id}, {"$set": {"stock": v}})
    for k, v in m_targets.items():
        await db.materials.update_one({"id": M[k].id}, {"$set": {"quantity": v}})
    await db.products.update_many({"track_stock": False}, {"$set": {"stock": 0}})


async def main():
    await ensure_indexes()
    await ensure_admin()
    if "--reset" in sys.argv:
        for c in COLLECTIONS:
            await db[c].drop()
        await ensure_indexes()
    if await db.products.count_documents({}) == 0:
        await seed()
        print("Demo data seeded.")
    else:
        print("Data exists; skipped (use --reset to reseed).")
    print(f"Admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
