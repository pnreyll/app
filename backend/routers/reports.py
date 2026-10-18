"""Profitability report + dashboard aggregates."""

from datetime import date as Date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.dates import today_iso
from lib.db import db
from lib.services import TZ, account_balances, contact_balances, low_stock_items, r2
from models.erp import RAW_PURCHASE_CATEGORY, Dashboard, NameAmount, ProductMargin, ProfitReport, Roast, Sale, SeriesPoint, AccountOut

router = APIRouter(dependencies=[Depends(require_admin)], tags=["reports"])
METHOD_LABELS = {"cash": "Nakit", "card": "Kredi Kartı", "transfer": "Havale / EFT", "credit": "Veresiye"}


def _bucket(d: str, group: str) -> str:
    if group == "week":
        dt = Date.fromisoformat(d)
        return (dt - timedelta(days=dt.weekday())).isoformat()
    if group == "month":
        return d[:7]
    return d


async def build_report(start: str, end: str, group: str = "day") -> ProfitReport:
    try:
        s_dt, e_dt = Date.fromisoformat(start), Date.fromisoformat(end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz tarih")
    rng = {"$gte": start, "$lte": end}
    sales = await db.sales.find({"date": rng, "status": {"$ne": "İptal"}}).to_list(20000)
    expenses = await db.expenses.find({"date": rng}).to_list(20000)

    series: dict[str, SeriesPoint] = {}
    if group == "day" and (e_dt - s_dt).days <= 400:
        d = s_dt
        while d <= e_dt:
            series[d.isoformat()] = SeriesPoint(key=d.isoformat())
            d += timedelta(days=1)
    by_method: dict[str, float] = {}
    by_channel: dict[str, float] = {}
    prods: dict[str, dict] = {}
    for s in sales:
        b = series.setdefault(_bucket(s["date"], group), SeriesPoint(key=_bucket(s["date"], group)))
        b.revenue += s["subtotal"]
        b.cogs += s["cogs"]
        b.orders += 1
        setattr(b, s["payment_method"], getattr(b, s["payment_method"]) + s["total"])
        by_method[s["payment_method"]] = by_method.get(s["payment_method"], 0) + s["total"]
        ch = "B2B Toptan" if s["channel"] == "B2B" else "B2C Perakende / Kafe"
        by_channel[ch] = by_channel.get(ch, 0) + s["subtotal"]
        for it in s["items"]:
            p = prods.setdefault(it["product_id"], {"name": it["name"], "quantity": 0.0, "revenue": 0.0, "cogs": 0.0})
            p["quantity"] += it["quantity"]
            p["revenue"] += it["net"]
            p["cogs"] += it["unit_cost"] * it["quantity"]
    exp_cat: dict[str, float] = {}
    fixed = variable = purchases = 0.0
    for e in expenses:
        if e["category"] == RAW_PURCHASE_CATEGORY:
            purchases += e["amount_try"]
            continue
        exp_cat[e["category"]] = exp_cat.get(e["category"], 0) + e["amount_try"]
        if e.get("is_fixed"):
            fixed += e["amount_try"]
        else:
            variable += e["amount_try"]
        b = series.setdefault(_bucket(e["date"], group), SeriesPoint(key=_bucket(e["date"], group)))
        b.expenses += e["amount_try"]
    points = []
    for k in sorted(series):
        p = series[k]
        p.profit = r2(p.revenue - p.cogs - p.expenses)
        for f in ("revenue", "cogs", "expenses", "cash", "card", "transfer", "credit"):
            setattr(p, f, r2(getattr(p, f)))
        points.append(p)
    revenue_net = sum(s["subtotal"] for s in sales)
    cogs = sum(s["cogs"] for s in sales)
    opex = fixed + variable
    net = revenue_net - cogs - opex
    return ProfitReport(
        start=start, end=end, group=group, gross_sales=r2(sum(s["total"] for s in sales)), revenue_net=r2(revenue_net),
        vat_total=r2(sum(s["vat_total"] for s in sales)), cogs=r2(cogs), gross_profit=r2(revenue_net - cogs), opex=r2(opex),
        fixed_expenses=r2(fixed), variable_expenses=r2(variable), purchases=r2(purchases), net_profit=r2(net),
        margin_pct=round(net / revenue_net * 100, 1) if revenue_net else 0, order_count=len(sales),
        by_method=[NameAmount(name=METHOD_LABELS[k], amount=r2(v)) for k, v in by_method.items()],
        by_channel=[NameAmount(name=k, amount=r2(v)) for k, v in by_channel.items()],
        expenses_by_category=sorted((NameAmount(name=k, amount=r2(v)) for k, v in exp_cat.items()), key=lambda x: -x.amount),
        series=points,
        products=sorted(
            (ProductMargin(product_id=k, name=v["name"], quantity=r2(v["quantity"]), revenue=r2(v["revenue"]), cogs=r2(v["cogs"]),
                           margin_pct=round((v["revenue"] - v["cogs"]) / v["revenue"] * 100, 1) if v["revenue"] else 0)
             for k, v in prods.items()), key=lambda x: -x.revenue),
    )


@router.get("/reports/profit", response_model=ProfitReport)
async def profit_report(start: str, end: str, group: Literal["day", "week", "month"] = "day"):
    return await build_report(start, end, group)


@router.get("/dashboard", response_model=Dashboard)
async def dashboard():
    today = today_iso(TZ)
    month_start = today[:8] + "01"
    t = Date.fromisoformat(today)
    month = await build_report(month_start, today, "day")
    last14 = await build_report((t - timedelta(days=13)).isoformat(), today, "day")
    today_sales = [s for s in await db.sales.find({"date": today, "status": {"$ne": "İptal"}}).to_list(5000)]
    by_method: dict[str, float] = {}
    for s in today_sales:
        by_method[s["payment_method"]] = by_method.get(s["payment_method"], 0) + s["total"]
    roasts_month = await db.roasts.find({"date": {"$gte": month_start, "$lte": today}}).to_list(2000)
    losses = [r["loss_pct"] for r in roasts_month if r["loss_pct"] > 0]
    recent_roasts = [Roast(**r) for r in await db.roasts.find().sort([("date", -1), ("created_at", -1)]).to_list(5)]
    recent_sales = [Sale(**s) for s in await db.sales.find().sort([("date", -1), ("created_at", -1)]).to_list(6)]
    top: dict[str, float] = {}
    for s in await db.sales.find({"date": {"$gte": month_start, "$lte": today}, "status": {"$ne": "İptal"}, "customer_id": {"$ne": None}}).to_list(20000):
        top[s["customer_name"]] = top.get(s["customer_name"], 0) + s["total"]
    balances = await contact_balances()
    accounts = await account_balances()
    return Dashboard(
        today=today, today_sales=r2(sum(s["total"] for s in today_sales)), today_orders=len(today_sales),
        today_by_method=[NameAmount(name=METHOD_LABELS[k], amount=r2(v)) for k, v in by_method.items()],
        month=month, last14=last14.series,
        roasted_kg_month=r2(sum(r["output_quantity"] for r in roasts_month if r["output_unit"] == "KG")),
        roast_count_month=len(roasts_month), avg_loss_pct=round(sum(losses) / len(losses), 1) if losses else 0,
        low_stock=await low_stock_items(), recent_roasts=recent_roasts, recent_sales=recent_sales,
        top_customers=sorted((NameAmount(name=k, amount=r2(v)) for k, v in top.items()), key=lambda x: -x.amount)[:5],
        receivables=r2(sum(v for v in balances.values() if v > 0)), payables=r2(-sum(v for v in balances.values() if v < 0)),
        cash_total=r2(sum(a["balance_try"] for a in accounts)), accounts=[AccountOut(**a) for a in accounts],
    )
