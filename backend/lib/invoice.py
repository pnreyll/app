"""Sale receipt / invoice PDF (reportlab). Fonts are bundled so Turkish glyphs render everywhere."""

from io import BytesIO
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_DIR = Path(__file__).parent.parent / "assets" / "fonts"
pdfmetrics.registerFont(TTFont("Chrono", str(FONT_DIR / "LiberationSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Chrono-Bold", str(FONT_DIR / "LiberationSans-Bold.ttf")))

ESPRESSO = colors.HexColor("#2B1B13")
ACCENT = colors.HexColor("#C96D2D")
CREAM = colors.HexColor("#F5EDE4")
MUTED = colors.HexColor("#7D6E60")
METHODS = {"cash": "Nakit", "card": "Kredi Kartı", "transfer": "Havale / EFT", "credit": "Veresiye (Cari Hesap)"}


def tl(n: float) -> str:
    s = f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} TL"


def qty(n: float) -> str:
    return f"{n:g}".replace(".", ",")


def build_invoice_pdf(sale: dict, customer: Optional[dict]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Chrono Coffee House - {sale['number']}")
    st = lambda size=9, bold=False, color=ESPRESSO, align=0, leading=None: ParagraphStyle(  # noqa: E731
        "s", fontName="Chrono-Bold" if bold else "Chrono", fontSize=size, textColor=color, alignment=align, leading=leading or size * 1.35)
    el = []
    d = sale["date"].split("-")
    header = Table(
        [[
            [Paragraph("CHRONO COFFEE HOUSE", st(18, True)), Paragraph("Specialty Roastery &amp; Café", st(9, color=ACCENT)),
             Paragraph("Moda Cad. No: 12, Kadıköy / İstanbul · info@chronocoffee.com", st(8, color=MUTED))],
            [Paragraph("SATIŞ FİŞİ / FATURA", st(12, True, ACCENT, 2)), Paragraph(f"No: <b>{sale['number']}</b>", st(9, align=2)),
             Paragraph(f"Tarih: {d[2]}.{d[1]}.{d[0]}", st(9, align=2)),
             Paragraph(f"Kanal: {'B2B Toptan' if sale['channel'] == 'B2B' else 'B2C Perakende / Kafe'}", st(9, align=2))],
        ]],
        colWidths=[105 * mm, 69 * mm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, 0), 1.2, ACCENT), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    el += [header, Spacer(1, 8 * mm)]

    if customer:
        lines = [f"<b>{customer['name']}</b>"]
        if customer.get("address") or customer.get("city"):
            lines.append(" ".join(x for x in [customer.get("address", ""), customer.get("city", "")] if x))
        if customer.get("tax_no"):
            lines.append(f"Vergi No / TCKN: {customer['tax_no']}")
        if customer.get("phone") or customer.get("email"):
            lines.append(" · ".join(x for x in [customer.get("phone", ""), customer.get("email", "")] if x))
        el += [Paragraph("SAYIN", st(8, True, MUTED)), Paragraph("<br/>".join(lines), st(9.5)), Spacer(1, 6 * mm)]
    else:
        el += [Paragraph("Müşteri: Perakende Satış", st(9.5)), Spacer(1, 6 * mm)]

    rows = [["#", "Ürün", "SKU", "Miktar", "Birim Fiyat", "KDV", "Tutar"]]
    for i, it in enumerate(sale["items"], 1):
        rows.append([str(i), Paragraph(it["name"], st(9)), it["sku"], f"{qty(it['quantity'])} {it['unit']}", tl(it["unit_price"]), f"%{qty(it['vat_rate'])}", tl(it["total"])])
    t = Table(rows, colWidths=[8 * mm, 58 * mm, 24 * mm, 20 * mm, 26 * mm, 12 * mm, 26 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Chrono-Bold"), ("FONTNAME", (0, 1), (-1, -1), "Chrono"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), ESPRESSO), ("TEXTCOLOR", (0, 0), (-1, 0), CREAM),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF5EF")]),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, ACCENT), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    el += [t, Spacer(1, 5 * mm)]

    totals = Table(
        [["Ara Toplam (KDV Hariç)", tl(sale["subtotal"])], ["Toplam KDV", tl(sale["vat_total"])], ["GENEL TOPLAM", tl(sale["total"])]],
        colWidths=[45 * mm, 35 * mm], hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Chrono"), ("FONTSIZE", (0, 0), (-1, -1), 9), ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 2), (-1, 2), "Chrono-Bold"), ("FONTSIZE", (0, 2), (-1, 2), 11), ("TEXTCOLOR", (0, 2), (-1, 2), ACCENT),
        ("LINEABOVE", (0, 2), (-1, 2), 0.8, ESPRESSO), ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    el += [totals, Spacer(1, 6 * mm)]
    pay = f"Ödeme Yöntemi: <b>{METHODS.get(sale['payment_method'], sale['payment_method'])}</b>"
    if sale.get("account_name"):
        pay += f" · {sale['account_name']}"
    el += [Paragraph(pay, st(9)), Paragraph(f"Durum: {sale['status']}", st(9))]
    if sale.get("notes"):
        el += [Paragraph(f"Not: {sale['notes']}", st(9, color=MUTED))]
    el += [Spacer(1, 14 * mm), Paragraph("Chrono Coffee House'u tercih ettiğiniz için teşekkür ederiz. Taze kavrulmuş, zamansız lezzet.", st(8.5, color=MUTED, align=1)),
           Paragraph("Fiyatlara KDV dahildir. Bu belge bilgilendirme amaçlı satış fişidir.", st(7.5, color=MUTED, align=1))]
    doc.build(el)
    return buf.getvalue()
