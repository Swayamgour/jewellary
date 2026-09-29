# Jewellery ERP Backend — v2 (hardening release)

Audit ke har point (P0 → P3) ka fix. Sab kuch `npm test` se verify hai (16 unit + 23 integration tests).

## Naya flow — ek nazar me

```
KACHA/PAKKA  DRAFT ──confirm──▶ CONFIRMED ──payments / returns──▶ CANCELLED
                (kuch post nahi)   stock out + customer ledger debit
KACHA CONFIRMED ──convert──▶ CONVERTED  (Pakka invoice banta hai; payments + old-gold Pakka par shift;
                                         ledger me sirf GST difference post hota hai; stock dobara touch nahi)
```

## P0 — Critical
| Issue | Fix |
|---|---|
| Kacha→Pakka | DRAFT convert nahi hota (pehle confirm). Discount double-count bug fixed. Payments + exchange adjustments Pakka par move. Sirf GST difference ledger me. Ek Kacha sirf ek baar convert (unique index). Returns ke baad convert blocked. |
| Invoice cancel + payments | `paymentAction: CREDIT` (default, paisa customer credit) ya `REFUND` (cash/UPI/bank refund, `direction: OUT` payment record). Old-gold wapas customer credit. Partial return ke baad sirf bacha hua stock restore. Full audit. |
| Sales Return | Server value nikalta hai (discount + GST share), duplicate/excess return blocked, stock restore, credit note ledger, refund ya credit, invoice `returnedAmount/returnStatus`. |
| Purchase Return | `paid / due / refundDue / adjustedTotal / returnStatus` sahi reconcile hote hain; return snapshot me vendor balance. Vendor refund endpoint. |
| Inventory weight | Weights per-unit; stock weight = unit × quantity (movement `weightDelta`, `balanceWeight`, reports, dashboard). Stock updates atomic (`$inc` + condition) — oversell / double-sell nahi. |
| Payment/Ledger consistency | Invoice/Purchase/Order position hamesha Payment documents se re-derive (`InvoiceAccounting`, `PurchaseAccounting`). Ledger balance atomic `$inc`. Direct `/payments` API ab purchase/order update karta hai. Reconciliation endpoint. |

## P1 — Purchase
- **Purchase Order**: `DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED → CLOSED` (+ REJECTED, CANCELLED, short-close). `/api/purchase-orders/*`
- Purchase: DRAFT/COMPLETED/CANCELLED, update, confirm, cancel (sirf jab stock untouched), payment, refund, partial/complete receiving via PO.
- Purchase approval = PO approval (role based: Admin / Branch Manager).

## P2 — Reports (17) + Excel
sales, sales-returns, purchase, purchase-returns, payments, collections, expenses, profit-loss, cash-summary, exchange, old-gold, stock, gold-stock, silver-stock, stock-movement, customer-outstanding, vendor-outstanding.
Har report ka Excel: `GET /api/reports/export/excel?reportType=<name>`.
**Profit** ab: Net Sales − COGS − Expenses (cost invoice line par snapshot hoti hai).

## P3 — Production
- Real integration tests (`npm test`), unit tests, Postman collection regenerated (`npm run postman`, 72 requests).
- Transactions: production me replica set mandatory (`REQUIRE_TRANSACTIONS`), retry on write-conflict.
- Race-safe document numbers (`Counter` collection, gap-free with transactions) — random invoice/payment numbers hata diye.
- Branch isolation: doosri branch ki record id se access blocked.
- Optimistic concurrency on Invoice / Purchase / PO. Indexes added. JWT secret production me mandatory.
- Seeder production DB wipe karne se refuse karta hai (`--force` chahiye).
- `.env.example`, migration script.

## Aapko ye karna hai
1. `npm install`
2. **Pehle purane data ke liye**: `npm run migrate:v2` (dry run) → `npm run migrate:v2 -- --apply`
3. `.env` me `MONGO_URI` **replica set / Atlas** hona chahiye (transactions ke liye). Standalone local mongod par development chalega (warning ke saath), production me nahi.
4. `npm test` (integration ke liye `MONGO_URI_TEST` — DB ka naam `test` ho, wipe hota hai).

## Breaking changes (frontend ke liye)
- Invoice `status` ab sirf `DRAFT | CONFIRMED | CONVERTED | CANCELLED`. Payment progress → `paymentStatus` (`PENDING | PARTIAL | PAID`).
- Purchase return body: sirf `{items:[{barcode|purchaseItemId, quantity}], reason}` — amount server nikalta hai.
- Sales return body: `{items:[{invoiceItemId|barcode, quantity}], refundType, reason}`.
- Cancel body: `{reason, paymentAction: CREDIT|REFUND, refundMode}`.
- Bill create: optional `status: "DRAFT"`.
- `EXCHANGE` payment mode ab `/payments` se nahi; sirf Exchange module se.
- Dashboard: `estimatedNetProfit` ab actual `netProfit` ke barabar (naye fields: `costOfGoodsSold`, `grossProfit`).

## Honest limits
- Tests local FerretDB par chale (real MongoDB nahi). Do concurrency tests (last piece ek saath bechna, parallel invoice numbers) us engine par **skip** hote hain kyunki wo atomic conditional update nahi karta; real MongoDB/Atlas par ye automatically chalenge — pehli baar Atlas par `npm test` zaroor chalayein.
- Transactions (`withTransaction` with replica set) bhi FerretDB par exercise nahi hue; code standard Mongoose pattern hai par Atlas par verify karein.
- Purane invoices ki cost history nahi hoti → un lines ka profit overstate hoga (P&L `linesWithoutCost` batata hai).
- Frontend / Postman ke saath manual end-to-end pass abhi baaki hai.

## v2.1 — frontend-support patches (same day)
- `GET /api/billing` (unified list, every bill type/status, search) and `GET /api/billing/:id` (works for
  any bill, returns its `payments` and `salesReturns` inline) — added so the frontend has one register
  instead of separate Kacha/Pakka lists.
- `productId` is now **required** on every purchase / purchase-order line (a stock row must belong to a
  product design); `categoryId` auto-fills from the product when omitted.
- Search inputs (billing, sales, payments, inventory) now escape regex special characters
  (`src/utils/escapeRegex.js`) instead of passing raw user input into `$regex`.
- Payment list now returns `partyName` (customer/vendor name) per row instead of just an id.
