# Chrono Coffee House — ERP / CRM / Ön Muhasebe

Turkish-language, single-admin web app for a specialty coffee roastery + café. Dark espresso theme (Lora / Plus Jakarta Sans / JetBrains Mono).

## Auth
Single admin, email+password → httpOnly cookie session (7 days). All `/api/*` except `/api/auth/login` require it. Credentials: memory/test_credentials.md.

## Modules (routes)
- `/` Dashboard: today sales, month net profit, roasted kg, low-stock alerts, 14-day chart, channel donut, recent roasts/sales, top customers, receivables/payables, account balances.
- `/products` Product catalog: SKU, category, unit (KG/Adet/Paket), VAT, B2C & B2B price (VAT-inclusive), unit_cost, stock, critical level, track_stock (café menu = untracked). Manual stock adjust.
- `/green-beans`, `/materials`: `materials` collection with kind green_bean|material. Purchase dialog → increases stock + creates expense in category "Hammadde / Tedarikçi Alımı" (paid from account or on supplier credit). Manual adjust.
- `/roasting`: manual batch: inputs (any materials) deducted, output product stock increased, loss % computed for KG outputs. Delete reverts stock. Batch no R-0001.
- `/orders`: sales B2B/B2C; price = customer special price > channel price; stock decremented instantly (400 on insufficient stock). Payment cash/card/transfer → account transaction; credit (veresiye) → customer cari +total (customer required). Cancel (status İptal) or delete reverts stock + ledger. PDF: GET /api/sales/{id}/pdf (reportlab, bundled Liberation fonts).
- `/finance` Kasa & Banka: accounts (cash/bank/pos, TRY/USD/EUR), balances = opening + transactions; transfers (virman), manual in/out.
- `/expenses`: categories, fixed/variable flag, multi-currency (converted with settings rates), payment account or supplier credit.
- `/cari`: customers (alacak) / suppliers (borç), balances from cari_movements (+ = they owe us, − = we owe). Payment dialog: customer tahsilat (account in, cari −) / supplier ödeme (account out, cari +).
- `/reports`: profit report: net revenue (excl VAT) − COGS (product unit_cost at sale) − OPEX (all expenses except raw purchases) = net profit; day/week/month series incl. cash/card/transfer/credit split; expense pie; product margins.
- `/crm`, `/crm/:id`: customer cards, detail with stats, monthly chart, notes, favourite beans, special prices, order history, cari statement with running balance.
- Top bar: quick actions (?new=1 opens dialogs), low-stock popover, display currency switch (₺/$/€ on dashboard & reports) + editable rates (PUT /api/settings/rates).

## Seed (python seed.py --reset)
4 accounts (Merkez Kasa, Garanti BBVA Ticari TL, Akbank POS, İş Bankası USD), 3 suppliers, 5 customers (Moda Sahil Kafe has special prices), 13 products (SKU e.g. CCH-SIG-250, CCH-COL-250 low stock), 4 green beans + 7 materials (Kolombiya Huila, 1kg paket, süt low), 5 roasts, ~60 days of sales, 2 months of expenses. Rates USD 41.5 / EUR 48.2.
