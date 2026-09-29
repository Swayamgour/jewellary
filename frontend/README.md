# Jewellery ERP — Frontend (v2, aligned to backend v2)

React + Vite + Redux Toolkit Query frontend, rewritten to match `backend-v2` exactly (unified invoice
register, DRAFT bills, server-computed returns, Purchase Orders, 17 reports, party-safe payments).

## Setup
```bash
npm install
cp .env.example .env   # set VITE_API_URL to your backend, e.g. http://localhost:5001/api
npm run dev
```

Login with the seeded admin (`npm run seed` in the backend): `admin@jewelleryerp.com` / `Admin@12345`.

## What changed vs the old frontend
- **API layer** (`src/app/api/baseApi.js`) rewritten for every v2 endpoint: unified `/billing` list +
  generic `/billing/:id` detail (works for Kacha, Pakka, DRAFT, CONVERTED, CANCELLED), draft
  update/confirm, sales & purchase returns (frontend only sends quantities — the server prices them),
  Purchase Orders, vendor refunds, payment reversal, old-gold adjust/payout, and the 17-report registry
  (`getReport({ key, ...filters })`) with Excel export and a books-reconciliation view.
- **Billing (POS)**: rebuilt around stock-driven line items (weights/metal/purity come from the picked
  inventory row, never typed in), Save Draft vs Confirm & Save, hotkeys, and a live calculation preview
  in `utils/calculations.js` that is unit-tested against the exact same fixtures as the backend
  (`npm run test`).
- **Bill detail page**: one page for every bill type/status — shows payments, sales returns, Kacha↔Pakka
  conversion links, and cancellation settlement (refund vs customer credit).
- **Sales / Purchases**: return modals let the user pick quantities only; refund vs credit vs "adjust
  against due" is shown from what the server actually did. Purchases now support DRAFT, confirm, vendor
  refunds, and returns reconciled against `paid/due/refundDue`.
- **Purchase Orders** (new module): full DRAFT→SUBMITTED→APPROVED→ORDERED→PARTIALLY_RECEIVED→RECEIVED→
  CLOSED lifecycle with reject/cancel/short-close and partial/complete receiving.
- **Inventory**: per-unit vs total weight is shown correctly everywhere (a lot of 10 pcs × 10 g nets
  100 g); adjustment/transfer use `barcode` + `quantityDelta` as the API expects.
- **Payments**: single `/payments` register with direction (IN/OUT), reversal, and a record-payment
  modal that lets you tie a receipt to a specific open bill or purchase.
- **Old Gold / Exchange**: intake with melting-loss & purity calc, adjust-on-bill, and payout of any
  unused value.
- **Reports**: every one of the backend's 17 reports, dated filters where relevant, Excel export for
  any of them, and a "Books Check" panel that calls `/reports/reconciliation` and can re-derive
  invoice/purchase totals from their payments.
- Role-based sidebar (`utils/constants.js` `ACCESS`/`canAccess`) hides modules a role can't use, mirroring
  the backend's route guards — this is presentation-only, the backend remains the source of truth.

## Testing
```bash
npm run test        # vitest — calculation engine mirrors backend/tests/unit.test.js fixtures
npm run build        # production build (verified to complete cleanly)
```

## Known gaps / what to verify next
- No end-to-end browser test suite (Playwright/Cypress) — verified via a scripted HTTP smoke run against
  the live backend (login → purchase → bill → sales return → PO lifecycle → reports → reconciliation),
  not through the actual UI in a browser.
- Settings page's branch/GSTIN display still has a few hard-coded placeholder fallbacks (e.g. "Mumbai")
  when a branch field is empty — cosmetic only, replace with your real seed data.
- Barcode generation on the purchase entry form is left blank for "auto"; the backend will reject a
  purchase line with no barcode and no default generator wired from the UI — enter one manually or wire
  `utils/barcodeGenerator`-equivalent client-side if you want true auto-barcoding in the browser.
- Bundle is a single ~980 KB chunk (dev-fine; consider route-level `React.lazy` code-splitting before a
  slow-network production rollout).
